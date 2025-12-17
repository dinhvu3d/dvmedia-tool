const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { autoUpdater } = require('electron-updater');
const fluentFfmpeg = require('fluent-ffmpeg');
const { spawn } = require('child_process');
const http = require('http');

// ==========================================
// 1. SETUP & CONFIGURATION
// ==========================================
// Hàm hỗ trợ tìm file script (Python/Exe) bất kể Dev hay Production
const resolveResource = (fileName) => {
    if (app.isPackaged) {
        // Khi đóng gói: Tìm trong folder resources (cùng cấp với file exe)
        return path.join(process.resourcesPath, fileName);
    }
    // Khi chạy code: Tìm ở thư mục gốc (lên 1 cấp từ electron/)
    return path.join(__dirname, '../', fileName);
};

let ffmpegPath;
const buildFfmpeg = resolveResource('ffmpeg.exe');
const localFfmpeg = path.join(__dirname, '../ffmpeg.exe');

if (fs.existsSync(localFfmpeg)) ffmpegPath = localFfmpeg;
else if (fs.existsSync(buildFfmpeg)) ffmpegPath = buildFfmpeg;
else ffmpegPath = require('ffmpeg-static').replace('app.asar', 'app.asar.unpacked');

const ffprobePath = require('ffprobe-static').path.replace('app.asar', 'app.asar.unpacked');
fluentFfmpeg.setFfmpegPath(ffmpegPath);
fluentFfmpeg.setFfprobePath(ffprobePath);

const SECRET_SALT = "DVMEDIA_TOOL_2025_SECRET_KEY_@123"; 
const LICENSE_FILE = path.join(app.getPath('userData'), 'license.json');

// ==========================================
// 2. HELPERS (SHARED)
// ==========================================
const getMachineId = () => {
    try {
        const rawId = JSON.stringify(os.cpus()[0].model) + os.hostname() + os.platform() + os.arch();
        return crypto.createHash('md5').update(rawId).digest('hex').toUpperCase().substring(0, 16);
    } catch (e) { return "UNKNOWN-DEVICE-ID"; }
};
const generateActivationKey = (id) => {
    const hash = crypto.createHash('sha256').update(id + SECRET_SALT).digest('hex').toUpperCase();
    return hash.substring(0, 24).match(/.{1,4}/g).join('-');
};
const sendLog = (msg) => { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('system-log', msg); };
const sendDedupProgress = (data) => { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('dedup-progress', data); };
const sendDeleteProgress = (data) => { if(mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('delete-progress', data); };

const getDuration = (filePath) => new Promise((resolve) => fluentFfmpeg.ffprobe(filePath, (err, metadata) => resolve(err ? 0 : metadata.format.duration || 0)));
const getFilesSafeFull = (dir) => (!dir || !fs.existsSync(dir)) ? [] : fs.readdirSync(dir).map(f => path.join(dir, f)).filter(f => fs.lstatSync(f).isFile() && !f.startsWith('.'));
const getAverageDuration = async (files) => { if (!files.length) return 0; let t = 0; for(let i=0; i<Math.min(files.length, 5); i++) t += await getDuration(files[i]); return t / Math.min(files.length, 5); };

const ensureDir = (dir) => { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); };
const removeDir = (dir) => { if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true }); };

const getVideoInfo = (filePath) => new Promise((resolve) => {
    fluentFfmpeg.ffprobe(filePath, (err, metadata) => {
        if (err || !metadata.streams || !metadata.streams[0]) return resolve({ width: 0, height: 0, duration: 0 });
        const s = metadata.streams.find(s => s.codec_type === 'video') || metadata.streams[0];
        resolve({ width: s.width, height: s.height, duration: metadata.format.duration || 0 });
    });
});

// ==========================================
// 4. WINDOW MANAGEMENT
// ==========================================
let mainWindow;
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400, height: 900,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), nodeIntegration: false, contextIsolation: true, webSecurity: false },
    autoHideMenuBar: true, backgroundColor: '#11141c', icon: path.join(__dirname, '../build/icon.ico')
  });
  if (!app.isPackaged) mainWindow.loadURL('http://localhost:3000');
  else mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  
  // Updater Events
  autoUpdater.autoDownload = false;
  autoUpdater.on('checking-for-update', () => { if(mainWindow) mainWindow.webContents.send('update-status', { status: 'checking', msg: 'Checking for updates...' }); });
  autoUpdater.on('update-available', (info) => { if(mainWindow) mainWindow.webContents.send('update-status', { status: 'available', msg: `Version ${info.version} is available!` }); });
  autoUpdater.on('update-not-available', () => { if(mainWindow) mainWindow.webContents.send('update-status', { status: 'idle', msg: 'Latest version installed.' }); });
  autoUpdater.on('error', (err) => { if(mainWindow) mainWindow.webContents.send('update-status', { status: 'error', msg: 'Update error: ' + err.message }); });
  autoUpdater.on('download-progress', (progressObj) => { if(mainWindow) mainWindow.webContents.send('update-status', { status: 'downloading', msg: `Downloading... ${Math.round(progressObj.percent)}%` }); });
  autoUpdater.on('update-downloaded', (info) => { if(mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded', msg: 'Update downloaded. Restart to install?' }); });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { app.quit(); });

// ==========================================
// 5. IPC HANDLERS - CORE & UTILS
// ==========================================
ipcMain.handle('license:check', async () => {
    try {
        if (!fs.existsSync(LICENSE_FILE)) return { activated: false };
        const data = JSON.parse(fs.readFileSync(LICENSE_FILE, 'utf-8'));
        if (data.key === generateActivationKey(getMachineId())) return { activated: true };
        return { activated: false };
    } catch { return { activated: false }; }
});
ipcMain.handle('license:activate', async (e, k) => {
    if (k.trim().toUpperCase() === generateActivationKey(getMachineId())) {
        fs.writeFileSync(LICENSE_FILE, JSON.stringify({ key: k.trim().toUpperCase(), machineId: getMachineId() }));
        return { success: true };
    }
    return { success: false, message: "Invalid Key" };
});
ipcMain.handle('license:getMachineId', () => getMachineId());
ipcMain.handle('updater:check', () => { if (!app.isPackaged) return; autoUpdater.checkForUpdates(); });
ipcMain.handle('updater:download', () => autoUpdater.downloadUpdate());
ipcMain.handle('updater:install', () => { app.removeAllListeners("window-all-closed"); const w = BrowserWindow.getAllWindows(); w.forEach(win => win.destroy()); setImmediate(() => autoUpdater.quitAndInstall(true, true)); });

ipcMain.handle('dialog:openDirectory', async () => (await dialog.showOpenDialog(mainWindow, { properties: ['openDirectory'] })).filePaths[0] || null);
ipcMain.handle('dialog:openFile', async (e, filters) => { 
    let f = [{ name: 'All Files', extensions: ['*'] }];
    if(filters) f = filters;
    const r = await dialog.showOpenDialog(mainWindow, { properties: ['openFile'], filters: f }); 
    return r.canceled ? null : r.filePaths[0]; 
});
ipcMain.handle('dialog:saveFile', async (e, options) => { 
    const opts = options || { title: 'Save File', defaultPath: 'Output.mp4', filters: [{ name: 'Movies', extensions: ['mp4'] }] };
    const r = await dialog.showSaveDialog(mainWindow, opts); 
    return r.canceled ? null : r.filePath; 
});
ipcMain.handle('system:getFonts', async () => {
    const fontsDir = 'C:\\Windows\\Fonts'; if (!fs.existsSync(fontsDir)) return [];
    try { return fs.readdirSync(fontsDir).filter(f => ['.ttf', '.otf', '.ttc'].includes(path.extname(f).toLowerCase())).map(f => ({ name: f, path: path.join(fontsDir, f) })); } catch (e) { return []; }
});

// ==========================================
// 6. TOOLS HANDLERS
// ==========================================

// --- DELETE SHORT ---
let isStopDel = false; 
ipcMain.handle('backend:stopDelete', () => { isStopDel = true; return {success:true}; });
ipcMain.handle('backend:deleteShort', async (e, { targetDir, minDuration }) => {
    try {
        isStopDel = false; let deletedCount = 0;
        const allFiles = fs.readdirSync(targetDir)
            .map(f => path.join(targetDir, f))
            .filter(f => fs.lstatSync(f).isFile() && ['.mp4','.mov','.mkv','.avi'].includes(path.extname(f).toLowerCase()));
        
        const total = allFiles.length;
        sendLog(`[DELETE] Starting scan ${total} files...`);
        const BATCH_SIZE = 5;
        for (let i = 0; i < total; i += BATCH_SIZE) {
            if (isStopDel) break;
            const batch = allFiles.slice(i, i + BATCH_SIZE);
            await Promise.all(batch.map(async (p) => {
                try {
                    const dur = await getDuration(p);
                    if (dur < minDuration) { fs.unlinkSync(p); deletedCount++; sendLog(`[DELETED] ${path.basename(p)} (${dur.toFixed(1)}s)`); }
                } catch(err) { /* ignore */ }
            }));
            sendDeleteProgress({ current: Math.min(i + BATCH_SIZE, total), total: total });
        }
        return { success: true, message: `Finished. Deleted ${deletedCount} files.` };
    } catch(err) { return { success: false, message: err.message }; }
});

// --- RENAME ---
let isStopRen = false; 
ipcMain.handle('backend:stopRename', () => { isStopRen = true; return {success:true}; });
ipcMain.handle('backend:rename', async (e, { inputDir, outputDir }) => {
    try { isStopRen = false; if(!fs.existsSync(outputDir)) fs.mkdirSync(outputDir, {recursive:true}); let c = 0, used = new Set(); const files = getFilesSafeFull(inputDir).filter(f=>['.mp4','.mov','.mkv'].includes(path.extname(f))).sort((a,b)=>path.basename(a).localeCompare(path.basename(b), undefined, {numeric:true})); sendLog(`[RENAME] Processing ${files.length} files...`); for(const f of files) { if(isStopRen) break; let num; do { num = Math.floor(10000+Math.random()*90000); } while(used.has(num)); used.add(num); const newName = `${num}${path.extname(f)}`; fs.copyFileSync(f, path.join(outputDir, newName)); sendLog(`[OK] ${path.basename(f)} -> ${newName}`); c++; } return { success: true, message: `Renamed ${c} files.` }; } catch(err) { return { success: false, message: err.message }; }
});

ipcMain.handle('backend:checkMax', async (e, { inputDirs, config }) => {
    try {
        const { normal, voice, other } = inputDirs;
        const filesN = getFilesSafeFull(normal);
        const filesV = getFilesSafeFull(voice);
        const filesO = getFilesSafeFull(other);

        if (!filesN.length && !filesV.length && !filesO.length) {
            return { success: false, message: "No input files found.", maxCount: 0 };
        }

        const avgN = await getAverageDuration(filesN) || 5; 
        const avgV = await getAverageDuration(filesV) || 5;
        const avgO = await getAverageDuration(filesO) || 5;

        const targetDur = config.duration * 60;
        const otherInterval = (config.otherInterval || 2) * 60;
        let nextOtherTime = (config.otherStart || 0) * 60;
        const useOther = config.enableOther && filesO.length > 0;

        const pattern = [];
        for(let i=0; i<(config.counts.normal||0); i++) pattern.push('normal');
        for(let i=0; i<(config.counts.voice||0); i++) pattern.push('voice');
        if (pattern.length === 0) {
            if (filesN.length) pattern.push('normal');
            else if (filesV.length) pattern.push('voice');
        }
        
        let simTime = 0;
        let neededN = 0, neededV = 0, neededO = 0, patternIdx = 0;

        while(simTime < targetDur) {
            if (useOther && simTime >= nextOtherTime) {
                simTime += avgO; neededO++; nextOtherTime += otherInterval; continue;
            }
            if (pattern.length === 0) { simTime += 10; continue; } 
            
            const type = pattern[patternIdx % pattern.length];
            if (type === 'normal') { simTime += avgN; neededN++; } else { simTime += avgV; neededV++; }
            patternIdx++;
        }

        let maxN = 999999, maxV = 999999, maxO = 999999;
        if (neededN > 0) maxN = Math.floor(filesN.length / neededN); else if (filesN.length > 0 && config.counts.normal > 0) maxN = 0; 
        if (neededV > 0) maxV = Math.floor(filesV.length / neededV); else if (filesV.length > 0 && config.counts.voice > 0) maxV = 0;
        if (neededO > 0) maxO = Math.floor(filesO.length / neededO);
        
        let possibleCount = 999999;
        if (config.counts.normal > 0) possibleCount = Math.min(possibleCount, maxN);
        if (config.counts.voice > 0) possibleCount = Math.min(possibleCount, maxV);
        if (useOther) possibleCount = Math.min(possibleCount, maxO);
        if (possibleCount === 999999) possibleCount = 0;

        const detailMsg = `Analysis:\n- Normal: ${filesN.length} (Need ~${neededN}/vid)\n- Voice: ${filesV.length} (Need ~${neededV}/vid)\n- Other: ${filesO.length} (Need ~${neededO}/vid)`;
        return { success: true, message: `Result: Can create approx ${possibleCount} videos.\n${detailMsg}`, maxCount: possibleCount };
    } catch(err) { return { success: false, message: err.message, maxCount: 0 }; }
});

// --- DEDUP ---
let dedupProcess = null;
ipcMain.handle('backend:stopDedup', () => { if (dedupProcess) { dedupProcess.kill(); dedupProcess = null; return { success: true }; } return { success: false }; });
ipcMain.handle('backend:startDedup', async (event, { folderPath }) => {
    if (!fs.existsSync(folderPath)) return { success: false, message: "Folder not found" };
    
    // FIX PATH: Tìm đúng file dedup_engine.py trong folder resources
    let scriptPath = resolveResource('dedup_engine.py');

    if (!fs.existsSync(scriptPath)) {
        sendLog(`[ERR] Engine not found at: ${scriptPath}`);
        return { success: false, message: "Python engine not found" };
    }
    
    sendLog(`[DEDUP] Starting Engine: ${path.basename(scriptPath)}`);
    
    return new Promise((resolve) => {
        let isResolved = false;
        const pythonEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' };

        dedupProcess = spawn('python', ['-u', scriptPath, folderPath, ffmpegPath], { env: pythonEnv });
        
        dedupProcess.stdout.on('data', (data) => {
            const lines = data.toString().split('\n');
            lines.forEach(line => {
                const trimmed = line.trim();
                if (!trimmed) return;
                try {
                    const msg = JSON.parse(trimmed);
                    if (msg.type === 'progress') sendDedupProgress(msg);
                    else if (msg.type === 'match') sendLog(`[MATCH] ${msg.file_b} similar to ${msg.file_a} (${msg.score}%)`);
                    else if (msg.type === 'error') {
                        sendLog(`[ERR] ${msg.message}`);
                        if (!isResolved) { isResolved = true; resolve({ success: false, message: msg.message }); }
                    }
                    else if (msg.type === 'done') {
                        if (!isResolved) { isResolved = true; dedupProcess = null; resolve({ success: true, message: msg.message }); }
                    }
                } catch (e) { if(trimmed) sendLog(`[RAW] ${trimmed}`); }
            });
        });

        dedupProcess.stderr.on('data', (data) => { sendLog(`[ERR] ${data.toString()}`); });
        
        dedupProcess.on('close', (code) => { 
            dedupProcess = null; 
            if (!isResolved) {
                isResolved = true;
                if (code === 0) resolve({ success: true, message: "Scan finished successfully." });
                else resolve({ success: false, message: `Engine exited unexpectedly (Code ${code}).` });
            }
        });
    });
});

// --- CONVERT 9:16 ---
let isStopConvert = false;
ipcMain.handle('backend:stopConvert9to16', () => { isStopConvert = true; return {success:true}; });
ipcMain.handle('backend:convert9to16', async (e, { inputType, inputPath, outputFile, blurLevel, resolution, encoder }) => {
    try {
        isStopConvert = false;
        const [resString, _, fps] = resolution.split('_'); 
        const [targetW, targetH] = resString.split('x');
        
        // Lấy cấu hình GPU (Chỉ dùng phần codec để encode, không dùng hw_dec để tránh lỗi filter)
        const { codec } = getEncoderConfig(encoder || 'libx264');

        const complexFilter = [
            `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},gblur=sigma=80[bg]`,
            `[0:v]scale=-1:${targetH}:flags=lanczos[fg]`,
            `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`
        ];

        // SINGLE MODE
        if(inputType === 'file') {
            sendLog(`[CONVERT] Processing single file with ${encoder || 'CPU'}...`);
            await new Promise((resolve, reject) => {
                const cmd = fluentFfmpeg(inputPath)
                    .complexFilter(complexFilter)
                    // Thay thế .videoCodec(...) bằng .outputOptions(codec)
                    .outputOptions(codec) 
                    .addOption('-pix_fmt', 'yuv420p')
                    .addOption('-r', fps);
                
                cmd.save(outputFile)
                   .on('end', resolve)
                   .on('error', reject);
            });
            return { success: true, message: "Convert Done!" };
        } 
        
        // BATCH MODE
        else {
            const files = getFilesSafeFull(inputPath).filter(f => ['.mp4','.mov','.mkv'].includes(path.extname(f)));
            if (files.length === 0) return { success: false, message: "No video files found." };
            if(!fs.existsSync(outputFile)) fs.mkdirSync(outputFile, {recursive:true});
            
            sendLog(`[CONVERT] Found ${files.length} files. Engine: ${encoder || 'CPU'}`);
            
            for(let i=0; i<files.length; i++) {
                if(isStopConvert) break;
                const file = files[i];
                const outName = path.join(outputFile, path.basename(file));
                sendLog(`[${i+1}/${files.length}] Converting: ${path.basename(file)}`);
                try {
                    await new Promise((resolve, reject) => {
                        const cmd = fluentFfmpeg(file)
                            .complexFilter(complexFilter)
                            .outputOptions(codec) // GPU Config
                            .addOption('-r', fps);
                        
                        cmd.save(outName)
                           .on('end', resolve)
                           .on('error', reject);
                    });
                } catch(err) {
                    sendLog(`[ERR] Failed ${path.basename(file)}: ${err.message}`);
                }
            }
            return { success: true, message: "Batch Convert Finished." };
        }
    } catch(err) { return { success: false, message: err.message }; }
});

// ==========================================
// 7. MERGE (FIXED STOP, INTRO & FONTS & PATHS)
// ==========================================
let isStopMerge = false;
ipcMain.handle('backend:stopMerge', () => { isStopMerge = true; return { success: true }; });

ipcMain.handle('backend:merge', async (e, { inputDirs, outputFile, config, overlayConfig, deleteSources, introPath }) => {
    isStopMerge = false; 
    const { normal, voice, other } = inputDirs;
    const workDir = path.join(path.dirname(outputFile), `.merge_temp_${Date.now()}`);
    ensureDir(workDir);
    
    try {
        let filesN = getFilesSafeFull(normal).sort(()=>Math.random()-.5);
        let filesV = getFilesSafeFull(voice).sort(()=>Math.random()-.5);
        let filesO = getFilesSafeFull(other).sort(()=>Math.random()-.5);

        const [resString, _, fps] = config.resolution.split('_'); 
        const [targetW, targetH] = resString.split('x');
        const isVerticalOutput = parseInt(targetW) < parseInt(targetH); 
        
        // Lấy cấu hình Encoder từ config (hoặc mặc định CPU)
        const encoderName = config.encoder || 'libx264';
        const { codec } = getEncoderConfig(encoderName);
        sendLog(`[MERGE] Engine: ${encoderName} (Hybrid Mode)`);

        // --- 1. OVERLAY SETUP ---
        let overlayPngPath = null;
        if (overlayConfig && overlayConfig.enabled && (overlayConfig.text1 || overlayConfig.text2)) {
            sendLog("[MERGE] Generating Text Overlay...");
            const priorityFonts = [ overlayConfig.fontPath, "C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/arial.ttf" ];
            let finalFont = null;
            for (const f of priorityFonts) { if (f && fs.existsSync(f)) { finalFont = f; break; } }
            overlayConfig.fontPath = finalFont;

            const scriptPath = resolveResource('text_renderer.py');
            overlayPngPath = path.join(workDir, 'overlay.png');
            const pyPayload = { ...overlayConfig, width: parseInt(targetW), height: parseInt(targetH), position: isVerticalOutput ? 'top_right' : 'default' };
            
            await new Promise((resolve) => {
                if (!fs.existsSync(scriptPath)) { resolve(); return; }
                const pyEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' };
                const py = spawn('python', [scriptPath, JSON.stringify(pyPayload), overlayPngPath], { env: pyEnv });
                py.on('close', resolve);
                py.on('error', () => { overlayPngPath = null; resolve(); });
            });
            if (!fs.existsSync(overlayPngPath)) overlayPngPath = null;
        }

        let curTime = 0;
        const targetDuration = config.duration * 60;
        const otherInterval = (config.otherInterval || 2) * 60;
        let nextOtherTime = (config.otherStart || 0) * 60;
        const useOther = config.enableOther && filesO.length > 0;

        const pattern = [];
        for(let i=0; i<config.counts.normal; i++) pattern.push('normal');
        for(let i=0; i<config.counts.voice; i++) pattern.push('voice');
        let patternIdx = 0;

        const tempSegments = [];
        const usedFiles = new Set();

        // --- 2. NORMALIZE VIDEO (GPU ENABLED) ---
        const normalizeVideo = async (filePath, index, shouldMute, isIntro = false) => {
            if (isStopMerge) return null;
            usedFiles.add(filePath);
            const info = await getVideoInfo(filePath);
            const isVerticalInput = info.width < info.height;
            const tempPath = path.join(workDir, `seg_${index}.mp4`);
            
            let complexFilter = [];
            let baseFilter = '';
            
            if (config.autoConvert9to16) {
                baseFilter = `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},gblur=sigma=80[bg];[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`;
            } else {
                baseFilter = `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
            }

            if (!isIntro && overlayPngPath) {
                baseFilter += `[v_base];[v_base][1:v]overlay=0:0`;
                complexFilter = [baseFilter];
            } else { complexFilter = [baseFilter]; }

            await new Promise((resolve, reject) => {
                const cmd = fluentFfmpeg(filePath);
                if (!isIntro && overlayPngPath) cmd.input(overlayPngPath);
                
                cmd.complexFilter(complexFilter)
                    // ÁP DỤNG GPU CODEC TẠI ĐÂY
                    .outputOptions(codec)
                    .addOption('-r', fps)
                    .audioCodec('aac').addOption('-ar', '44100').addOption('-ac', '2');
                
                if (shouldMute) cmd.audioFilters('volume=0');
                if (isStopMerge) { cmd.kill(); reject(new Error("Stopped")); return; }
                cmd.save(tempPath).on('end', resolve).on('error', reject);
            });
            return tempPath;
        };

        let segIdx = 0;
        sendLog(`[MERGE] Start loop... Target: ${targetDuration}s`);

        // PROCESS INTRO
        if (introPath && fs.existsSync(introPath)) {
            sendLog(`[MERGE] Adding Intro: ${path.basename(introPath)}`);
            try {
                const introSeg = await normalizeVideo(introPath, segIdx, false, true);
                if (introSeg) { tempSegments.push(introSeg); curTime += await getDuration(introSeg); segIdx++; }
            } catch (err) { if(isStopMerge) throw new Error("Stopped"); sendLog(`[WARN] Intro fail: ${err.message}`); }
        }

        // MAIN LOOP
        while(curTime < targetDuration) {
            if (isStopMerge) throw new Error("Stopped");
            let selectedFile = null, type = '';

            if (useOther && curTime >= nextOtherTime) {
                if (filesO.length === 0) filesO = getFilesSafeFull(other).sort(()=>Math.random()-.5);
                selectedFile = filesO.pop(); type = 'other'; nextOtherTime += otherInterval;
            } else {
                if (pattern.length === 0) break;
                type = pattern[patternIdx % pattern.length];
                if (type === 'normal') { if (filesN.length === 0) filesN = getFilesSafeFull(normal).sort(()=>Math.random()-.5); selectedFile = filesN.pop(); } 
                else { if (filesV.length === 0) filesV = getFilesSafeFull(voice).sort(()=>Math.random()-.5); selectedFile = filesV.pop(); }
                patternIdx++;
            }

            if (!selectedFile) break;
            sendLog(`[MERGE] Adding ${type}: ${path.basename(selectedFile)}`);
            try {
                let segmentPath = await normalizeVideo(selectedFile, segIdx, (type === 'other' && config.muteOther), false);
                tempSegments.push(segmentPath); curTime += await getDuration(segmentPath); segIdx++;
            } catch(e) { if (isStopMerge) throw e; }
        }

        if (tempSegments.length === 0) throw new Error("No clips processed");
        if (isStopMerge) throw new Error("Stopped");

        sendLog(`[MERGE] Concatenating ${tempSegments.length} clips...`);
        const listPath = path.join(workDir, 'list.txt');
        fs.writeFileSync(listPath, tempSegments.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n'));
        
        await new Promise((resolve, reject) => { 
            const cmd = fluentFfmpeg().input(listPath).inputOptions(['-f concat', '-safe', '0']).outputOptions(['-c copy']);
            if (isStopMerge) { cmd.kill(); reject(new Error("Stopped")); return; }
            cmd.save(outputFile).on('end', resolve).on('error', reject); 
        });
        
        removeDir(workDir); 
        if (deleteSources && !isStopMerge) { 
            sendLog(`[CLEANUP] Deleting ${usedFiles.size} source files...`); 
            for (const f of usedFiles) { try { if(fs.existsSync(f)) fs.unlinkSync(f); } catch (e) {} }
        }
        return { success: true, message: "Merge Completed!" };
    } catch(err) { removeDir(workDir); return { success: false, message: err.message }; }
});

// --- SYNC VIDEO BACKEND ---
let syncProcess = null;

ipcMain.handle('backend:stopAnalyzeSync', () => {
    if (syncProcess) { syncProcess.kill(); syncProcess = null; return { success: true }; }
    return { success: false };
});

ipcMain.handle('backend:analyzeSync', async (e, { videoPath, audioPath, srtPath }) => {
    try {
        const tempId = Date.now();
        const tempDir = path.join(app.getPath('userData'), `sync_temp_${tempId}`);
        ensureDir(tempDir);

        // FIX PATH: Tìm file sync_engine.py
        const scriptPath = resolveResource('sync_engine.py');
        if (!fs.existsSync(scriptPath)) return { success: false, message: "Engine sync_engine.py not found!" };

        sendLog(`[SYNC] Starting analysis...`);
        
        return new Promise((resolve) => {
            let isResolved = false;
            const pythonEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' };

            // Gọi Python: script video audio srt temp_dir ffmpeg_path
            syncProcess = spawn('python', ['-u', scriptPath, videoPath, audioPath, srtPath, tempDir, ffmpegPath], { env: pythonEnv });

            syncProcess.stdout.on('data', (data) => {
                const lines = data.toString().split('\n');
                lines.forEach(line => {
                    const trimmed = line.trim();
                    if (!trimmed) return;
                    try {
                        const msg = JSON.parse(trimmed);
                        if (msg.type === 'progress') {
                            // Gửi tiến trình về UI
                            if(mainWindow) mainWindow.webContents.send('sync-progress', msg);
                        }
                        else if (msg.type === 'error') {
                            sendLog(`[ERR] ${msg.message}`);
                            if (!isResolved) { isResolved = true; resolve({ success: false, message: msg.message }); }
                        }
                        else if (msg.type === 'done') {
                            sendLog(`[SYNC] ${msg.message}`);
                            if (!isResolved) { 
                                isResolved = true; 
                                syncProcess = null;
                                // Trả về kết quả phân tích + đường dẫn tempDir để dùng cho bước sau
                                resolve({ success: true, data: { ...msg, tempDir } }); 
                            }
                        }
                    } catch (e) { sendLog(`[RAW] ${trimmed}`); }
                });
            });

            syncProcess.stderr.on('data', (d) => sendLog(`[PY-ERR] ${d.toString()}`));
            
            syncProcess.on('close', (code) => {
                syncProcess = null;
                if (!isResolved) {
                    isResolved = true;
                    if (code === 0) resolve({ success: false, message: "Process finished without data." });
                    else resolve({ success: false, message: `Exited with code ${code}` });
                }
            });
        });

    } catch (err) { return { success: false, message: err.message }; }
});

// ==========================================
// 8. SYNC VIDEO RENDER ENGINE (OPTIMIZED GPU & LOGIC)
// ==========================================

// Helper: Chạy lệnh FFmpeg
const runFfmpegCommand = (args) => {
    return new Promise((resolve, reject) => {
        const cmd = spawn(ffmpegPath, args);
        cmd.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg exited with code ${code}`));
        });
        cmd.on('error', (err) => reject(err));
    });
};

// Helper: Atempo Chain
const buildAtempoChain = (speed) => {
    if (Math.abs(speed - 1.0) < 0.01) return null;
    let chain = [];
    let s = speed;
    while (s > 2.0) { chain.push("atempo=2.0"); s /= 2.0; }
    while (s < 0.5) { chain.push("atempo=0.5"); s /= 0.5; }
    chain.push(`atempo=${s}`);
    return chain.join(',');
};

// Helper: Lấy tham số GPU tối ưu (Decoding + Encoding)
const getEncoderConfig = (encoderName) => {
    switch (encoderName) {
        case 'h264_nvenc': // NVIDIA
            return {
                // Input Flags: Kích hoạt giải mã bằng GPU (QUAN TRỌNG ĐỂ TĂNG TỐC)
                hw_dec: ['-hwaccel', 'cuda'], 
                // Output Flags: P4 là preset trung bình (nhanh hơn P6), constqp 22 giữ chất lượng tốt
                codec: ['-c:v', 'h264_nvenc', '-preset', 'p6', '-rc', 'constqp', '-cq', '14', '-spatial-aq', '1']
            };
        case 'h264_amf': // AMD
            return {
                hw_dec: ['-hwaccel', 'dxva2'], // Hoặc d3d11va
                codec: ['-c:v', 'h264_amf', '-usage', 'transcoding', '-quality', 'balanced']
            };
        case 'h264_qsv': // INTEL
            return {
                hw_dec: ['-hwaccel', 'qsv'],
                codec: ['-c:v', 'h264_qsv', '-global_quality', '22', '-look_ahead', '0']
            };
        default: // CPU
            return {
                hw_dec: [],
                codec: ['-c:v', 'libx264', '-preset', 'veryfast', '-crf', '14']
            };
    }
};

// 1. BUILD GAP SEGMENT
const buildGapSegment = async (inputVideo, segIndex, segStart, segEnd, workDir, bgVolume, hasAudioStream, encoderName) => {
    const segDuration = Math.max(0.0, segEnd - segStart);
    if (segDuration < 0.1) return null;

    const segVideoOut = path.join(workDir, `seg_gap_${String(segIndex).padStart(4, '0')}.mp4`);
    
    // Configs
    const volNum = Number(bgVolume);
    const safeVol = isNaN(volNum) ? 0.3 : Math.max(0.0, volNum / 100.0);
    const { hw_dec, codec } = getEncoderConfig(encoderName);

    // Filters
    const vf = 'fps=30,format=yuv420p,setpts=PTS';
    let filterComplex = '';

    if (hasAudioStream) {
        const aChain = `volume=${safeVol},aresample=48000:async=1,aformat=sample_fmts=fltp:channel_layouts=stereo`;
        filterComplex = `[0:v]${vf}[vout];[0:a]${aChain}[aout]`;
    } else {
        filterComplex = `[0:v]${vf}[vout];anullsrc=r=48000:cl=stereo,atrim=duration=${segDuration.toFixed(3)}[aout]`;
    }

    const args = [
        '-y',
        ...hw_dec, // Thêm cờ giải mã phần cứng trước -i
        '-ss', `${segStart.toFixed(6)}`, '-to', `${segEnd.toFixed(6)}`,
        '-i', inputVideo,
        '-filter_complex', filterComplex,
        '-map', '[vout]', '-map', '[aout]',
        ...codec,  // Thêm cờ mã hóa phần cứng
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        segVideoOut
    ];

    await runFfmpegCommand(args);
    return segVideoOut;
};

// 2. BUILD LINE SEGMENT
const buildLineSegment = async (inputVideo, segIndex, segStart, segEnd, voicePath, voiceDuration, workDir, bgVolume, syncSpeed, hasAudioStream, encoderName) => {
    const segDuration = Math.max(0.0, segEnd - segStart);
    if (segDuration < 0.1 || voiceDuration < 0.1) {
        return buildGapSegment(inputVideo, segIndex, segStart, segEnd, workDir, bgVolume, hasAudioStream, encoderName);
    }

    const segVideoOut = path.join(workDir, `seg_line_${String(segIndex).padStart(4, '0')}.mp4`);
    
    // Configs
    const volNum = Number(bgVolume);
    const safeVol = isNaN(volNum) ? 0.3 : Math.max(0.0, volNum / 100.0);
    const targetDur = voiceDuration;
    const { hw_dec, codec } = getEncoderConfig(encoderName);

    // Logic Sync Speed
    let shouldAdjustSpeed = syncSpeed || (targetDur > segDuration);
    let ptsFilter = shouldAdjustSpeed 
        ? `setpts=${(Math.max(0.001, targetDur / segDuration)).toFixed(6)}*PTS`
        : `setpts=PTS`;

    const vfBase = 'fps=30,format=yuv420p';
    const a1Base = 'aresample=48000:async=1,aformat=sample_fmts=fltp:channel_layouts=stereo';

    let filterComplex = '';

    if (hasAudioStream) {
        const a0Base = `volume=${safeVol},aresample=48000:async=1,aformat=sample_fmts=fltp:channel_layouts=stereo`;
        let a0 = a0Base;
        if (shouldAdjustSpeed) {
            const fAudio = Math.max(0.001, segDuration / targetDur); 
            const atempoChain = buildAtempoChain(fAudio);
            if (atempoChain) a0 += `,${atempoChain}`;
        }
        filterComplex = `[0:v]${vfBase},${ptsFilter}[vout];[0:a]${a0},apad[a0p];[1:a]${a1Base},apad[a1p];[a0p][a1p]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[aout]`;
    } else {
        filterComplex = `[0:v]${vfBase},${ptsFilter}[vout];[1:a]${a1Base}[aout]`;
    }

    const args = [
        '-y',
        ...hw_dec, // Thêm cờ giải mã phần cứng
        '-ss', `${segStart.toFixed(6)}`, '-to', `${segEnd.toFixed(6)}`,
        '-i', inputVideo,
        '-i', voicePath,
        '-filter_complex', filterComplex,
        '-map', '[vout]', '-map', '[aout]',
        ...codec, // Thêm cờ mã hóa phần cứng
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
        '-shortest',
        segVideoOut
    ];

    await runFfmpegCommand(args);
    return segVideoOut;
};

// HANDLER CHÍNH
let renderProcessStop = false;
ipcMain.handle('backend:stopRenderSync', () => { renderProcessStop = true; return {success: true}; });

ipcMain.handle('backend:renderSync', async (e, { inputs, config, analysisData }) => {
    renderProcessStop = false;
    const { videoPath, outputPath } = inputs;
    const { audio_segments, tempDir } = analysisData; 
    const { bgVolume, syncSpeed, encoder } = config;

    const encoderName = encoder || 'libx264';
    sendLog(`[RENDER] Engine: ${encoderName} (HW Decode + Encode)`);

    const renderDir = path.join(tempDir, 'render_parts');
    ensureDir(renderDir);

    try {
        const vidInfo = await new Promise(r => fluentFfmpeg.ffprobe(videoPath, (err, data) => r(data)));
        const videoDur = vidInfo.format.duration;
        const hasAudioStream = vidInfo.streams.some(s => s.codec_type === 'audio');
        
        // --- LOGIC SYNC OPTIMIZED (OVERLAP PROTECTION) ---
        // Sắp xếp audio
        const sortedLines = [...audio_segments].sort((a,b) => a.start - b.start);
        
        const timeline = []; 
        let cur = 0.0; // Con trỏ thời gian video

        for (const ln of sortedLines) {
            // FIX QUAN TRỌNG: Chống lùi thời gian (Overlap)
            // Nếu dòng SRT tiếp theo bắt đầu (ln.start) nhỏ hơn vị trí hiện tại (cur),
            // Ta buộc phải đẩy nó về cur để tránh lỗi video lặp lại.
            let safeStart = Math.max(cur, ln.start);
            
            // Giới hạn trong độ dài video
            const s = Math.max(0.0, Math.min(safeStart, videoDur)); 
            const e = Math.max(0.0, Math.min(ln.end, videoDur)); 
            
            if (e <= s) continue; // Bỏ qua nếu lỗi thời gian
            
            // Nếu có khoảng trống từ 'cur' đến 's' -> Tạo GAP
            if (s > cur) {
                timeline.push({ type: 'gap', start: cur, end: s });
            }

            // Tạo LINE
            timeline.push({ type: 'line', start: s, end: e, ref: ln }); 
            cur = e;
        }

        // Tạo GAP cuối cùng nếu chưa hết video
        if (cur < videoDur) {
            timeline.push({ type: 'gap', start: cur, end: videoDur });
        }

        sendLog(`[RENDER] Timeline optimized: ${timeline.length} segments.`);

        // --- RENDER LOOP ---
        const segPaths = [];
        const totalSegs = timeline.length;

        for(let i=0; i<totalSegs; i++) {
            if (renderProcessStop) throw new Error("Stopped by user.");
            
            const item = timeline[i];
            const msg = item.type === 'line' ? `Voice: ${item.ref.text.substring(0, 15)}...` : `Gap`;
            
            if(mainWindow) mainWindow.webContents.send('render-progress', { 
                percent: Math.round((i / totalSegs) * 100), 
                step: `Rendering ${i+1}/${totalSegs}: ${msg}` 
            });

            try {
                let p = '';
                if (item.type === 'gap') {
                    p = await buildGapSegment(videoPath, i, item.start, item.end, renderDir, bgVolume, hasAudioStream, encoderName);
                } else {
                    p = await buildLineSegment(
                        videoPath, 
                        i, 
                        item.start, 
                        item.end, 
                        item.ref.file_path, 
                        item.ref.duration, 
                        renderDir, 
                        bgVolume, 
                        syncSpeed, 
                        hasAudioStream,
                        encoderName
                    );
                }
                if (p) segPaths.push(p);
            } catch (err) {
                sendLog(`[ERR] Seg ${i} Fail: ${err.message}`);
            }
        }

        // --- CONCAT FINAL ---
        if (segPaths.length === 0) throw new Error("No segments rendered.");
        
        if(mainWindow) mainWindow.webContents.send('render-progress', { percent: 99, step: "Finalizing..." });
        
        const listPath = path.join(renderDir, 'concat_list.txt');
        const fileContent = segPaths.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n');
        fs.writeFileSync(listPath, fileContent);

        await runFfmpegCommand([
            '-y', '-f', 'concat', '-safe', '0',
            '-i', listPath,
            '-c', 'copy',
            outputPath
        ]);

        if(mainWindow) mainWindow.webContents.send('render-progress', { percent: 100, step: "Done!" });
        removeDir(tempDir);

        return { success: true, message: "Done! Saved to: " + path.basename(outputPath) };

    } catch (err) {
        return { success: false, message: err.message };
    }
});