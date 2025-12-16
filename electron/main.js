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
let ffmpegPath;
const buildFfmpeg = path.join(process.resourcesPath, 'ffmpeg.exe');
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
  autoUpdater.autoDownload = false;
  // 1. Khi đang kiểm tra
  autoUpdater.on('checking-for-update', () => {
      if(mainWindow) mainWindow.webContents.send('update-status', { status: 'checking', msg: 'Checking for updates...' });
  });

  // 2. Khi PHÁT HIỆN bản mới (Quan trọng nhất: Bắn tín hiệu để React hiện Popup)
  autoUpdater.on('update-available', (info) => {
      if(mainWindow) mainWindow.webContents.send('update-status', { status: 'available', msg: `Version ${info.version} is available!` });
  });

  // 3. Khi không có gì mới
  autoUpdater.on('update-not-available', () => {
      if(mainWindow) mainWindow.webContents.send('update-status', { status: 'idle', msg: 'Latest version installed.' });
  });

  // 4. Khi gặp lỗi check
  autoUpdater.on('error', (err) => {
      if(mainWindow) mainWindow.webContents.send('update-status', { status: 'error', msg: 'Update error: ' + err.message });
  });

  // 5. Khi người dùng bấm Update -> Đang tải về
  autoUpdater.on('download-progress', (progressObj) => {
      let log_message = "Download speed: " + progressObj.bytesPerSecond;
      let percent = progressObj.percent;
      if(mainWindow) mainWindow.webContents.send('update-status', { status: 'downloading', msg: `Downloading... ${Math.round(percent)}%` });
  });

  // 6. Khi tải xong -> Hiện nút "Install Now"
  autoUpdater.on('update-downloaded', (info) => {
      if(mainWindow) mainWindow.webContents.send('update-status', { status: 'downloaded', msg: 'Update downloaded. Restart to install?' });
  });
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => {
    app.quit();
});

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
    // Cho phép options để lọc file output
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
        
        // 1. Get all files
        const filesN = getFilesSafeFull(normal);
        const filesV = getFilesSafeFull(voice);
        const filesO = getFilesSafeFull(other);

        if (!filesN.length && !filesV.length && !filesO.length) {
            return { success: false, message: "No input files found.", maxCount: 0 };
        }

        // 2. Calculate average duration (Sample first 5 files for speed)
        const avgN = await getAverageDuration(filesN) || 5; 
        const avgV = await getAverageDuration(filesV) || 5;
        const avgO = await getAverageDuration(filesO) || 5;

        // 3. Simulate ONE video build to find resource usage
        const targetDur = config.duration * 60;
        const otherInterval = (config.otherInterval || 2) * 60;
        let nextOtherTime = (config.otherStart || 0) * 60;
        const useOther = config.enableOther && filesO.length > 0;

        // Pattern Setup
        const pattern = [];
        for(let i=0; i<(config.counts.normal||0); i++) pattern.push('normal');
        for(let i=0; i<(config.counts.voice||0); i++) pattern.push('voice');
        if (pattern.length === 0) {
            if (filesN.length) pattern.push('normal');
            else if (filesV.length) pattern.push('voice');
        }
        
        let simTime = 0;
        let neededN = 0;
        let neededV = 0;
        let neededO = 0;
        let patternIdx = 0;

        while(simTime < targetDur) {
            // Check Other Clip
            if (useOther && simTime >= nextOtherTime) {
                simTime += avgO;
                neededO++;
                nextOtherTime += otherInterval;
                continue;
            }

            // Check Pattern
            if (pattern.length === 0) { simTime += 10; continue; } 
            
            const type = pattern[patternIdx % pattern.length];
            if (type === 'normal') {
                simTime += avgN;
                neededN++;
            } else {
                simTime += avgV;
                neededV++;
            }
            patternIdx++;
        }

        // 4. Calculate Max Output
        let maxN = 999999, maxV = 999999, maxO = 999999;

        if (neededN > 0) maxN = Math.floor(filesN.length / neededN);
        else if (filesN.length > 0 && config.counts.normal > 0) maxN = 0; 

        if (neededV > 0) maxV = Math.floor(filesV.length / neededV);
        else if (filesV.length > 0 && config.counts.voice > 0) maxV = 0;

        if (neededO > 0) maxO = Math.floor(filesO.length / neededO);
        
        let possibleCount = 999999;
        if (config.counts.normal > 0) possibleCount = Math.min(possibleCount, maxN);
        if (config.counts.voice > 0) possibleCount = Math.min(possibleCount, maxV);
        if (useOther) possibleCount = Math.min(possibleCount, maxO);

        if (possibleCount === 999999) possibleCount = 0;

        const detailMsg = `Analysis:\n- Normal: ${filesN.length} (Need ~${neededN}/vid)\n- Voice: ${filesV.length} (Need ~${neededV}/vid)\n- Other: ${filesO.length} (Need ~${neededO}/vid)`;
        
        return { 
            success: true, 
            message: `Result: Can create approx ${possibleCount} videos.\n${detailMsg}`, 
            maxCount: possibleCount 
        };

    } catch(err) { 
        return { success: false, message: err.message, maxCount: 0 }; 
    }
});

// --- DEDUP ---
let dedupProcess = null;
ipcMain.handle('backend:stopDedup', () => { if (dedupProcess) { dedupProcess.kill(); dedupProcess = null; return { success: true }; } return { success: false }; });
ipcMain.handle('backend:startDedup', async (event, { folderPath }) => {
    if (!fs.existsSync(folderPath)) return { success: false, message: "Folder not found" };
    
    let scriptPath = path.join(__dirname, '../dedup_engine.py');
    if (!fs.existsSync(scriptPath)) return { success: false, message: "Python engine not found" };
    
    sendLog(`[DEDUP] Starting Python Engine...`);
    
    return new Promise((resolve) => {
        let isResolved = false;
        const pythonEnv = { ...process.env, PYTHONIOENCODING: 'utf-8' };

        dedupProcess = spawn('python', ['-u', scriptPath, folderPath, ffmpegPath], { 
            env: pythonEnv 
        });
        
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
                        if (!isResolved) {
                            isResolved = true;
                            dedupProcess = null;
                            resolve({ success: true, message: msg.message });
                        }
                    }
                } catch (e) { 
                    if(trimmed) sendLog(`[RAW] ${trimmed}`);
                }
            });
        });

        dedupProcess.stderr.on('data', (data) => { sendLog(`[ERR] ${data.toString()}`); });
        
        dedupProcess.on('close', (code) => { 
            dedupProcess = null; 
            if (!isResolved) {
                isResolved = true;
                if (code === 0) {
                    resolve({ success: true, message: "Scan finished successfully." });
                } else {
                    resolve({ success: false, message: `Engine exited unexpectedly (Code ${code}). Check Logs for details.` });
                }
            }
        });
    });
});

// --- CONVERT 9:16 ---
let isStopConvert = false;
ipcMain.handle('backend:stopConvert9to16', () => { isStopConvert = true; return {success:true}; });
ipcMain.handle('backend:convert9to16', async (e, { inputType, inputPath, outputFile, blurLevel, resolution }) => {
    try {
        isStopConvert = false;
        const [resString, _, fps] = resolution.split('_'); 
        const [targetW, targetH] = resString.split('x');
        const complexFilter = [
            `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},gblur=sigma=80[bg]`,
            `[0:v]scale=-1:${targetH}:flags=lanczos[fg]`,
            `[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`
        ];

        // SINGLE MODE
        if(inputType === 'file') {
            sendLog(`[CONVERT] Processing single file...`);
            await new Promise((resolve, reject) => fluentFfmpeg(inputPath)
                .complexFilter(complexFilter)
                .videoCodec('libx264').addOption('-preset','slow').addOption('-crf','18').addOption('-pix_fmt','yuv420p').addOption('-r', fps)
                .save(outputFile).on('end', resolve).on('error', reject));
            return { success: true, message: "Convert Done!" };
        } 
        
        // BATCH MODE
        else {
            const files = getFilesSafeFull(inputPath).filter(f => ['.mp4','.mov','.mkv'].includes(path.extname(f)));
            if (files.length === 0) return { success: false, message: "No video files found." };
            if(!fs.existsSync(outputFile)) fs.mkdirSync(outputFile, {recursive:true});
            
            sendLog(`[CONVERT] Found ${files.length} files. Saving to: ${outputFile}`);
            
            for(let i=0; i<files.length; i++) {
                if(isStopConvert) break;
                const file = files[i];
                const outName = path.join(outputFile, path.basename(file));
                sendLog(`[${i+1}/${files.length}] Converting: ${path.basename(file)}`);
                try {
                    await new Promise((resolve, reject) => fluentFfmpeg(file)
                        .complexFilter(complexFilter)
                        .videoCodec('libx264').addOption('-preset','veryfast').addOption('-crf','20').addOption('-r', fps) 
                        .save(outName).on('end', resolve).on('error', reject));
                } catch(err) {
                    sendLog(`[ERR] Failed ${path.basename(file)}: ${err.message}`);
                }
            }
            return { success: true, message: "Batch Convert Finished." };
        }
    } catch(err) { return { success: false, message: err.message }; }
});

// ==========================================
// 7. MERGE (FIXED STOP, INTRO & FONTS)
// ==========================================
let isStopMerge = false;
ipcMain.handle('backend:stopMerge', () => { 
    isStopMerge = true; 
    return { success: true }; 
});

ipcMain.handle('backend:merge', async (e, { inputDirs, outputFile, config, overlayConfig, deleteSources, introPath }) => {
    isStopMerge = false; // Reset stop flag
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
        
        // --- 1. OVERLAY SETUP (AUTO DETECT FONTS) ---
        let overlayPngPath = null;
        if (overlayConfig && overlayConfig.enabled && (overlayConfig.text1 || overlayConfig.text2)) {
            sendLog("[MERGE] Generating Text Overlay...");
            
            // PRIORITY FONTS DETECTION (Chinese -> Korean -> Japanese -> English)
            const priorityFonts = [
                overlayConfig.fontPath, // User selected
                "C:/Windows/Fonts/msyh.ttc",   // Chinese
                "C:/Windows/Fonts/malgun.ttf", // Korean
                "C:/Windows/Fonts/meiryo.ttc", // Japanese
                "C:/Windows/Fonts/seguiemj.ttf", // Emoji
                "C:/Windows/Fonts/arial.ttf"
            ];
            
            let finalFont = null;
            for (const f of priorityFonts) {
                if (f && fs.existsSync(f)) { finalFont = f; break; }
            }
            overlayConfig.fontPath = finalFont;

            const scriptPath = path.join(__dirname, '../text_renderer.py');
            overlayPngPath = path.join(workDir, 'overlay.png');
            const pyPayload = { ...overlayConfig, width: parseInt(targetW), height: parseInt(targetH), position: isVerticalOutput ? 'top_right' : 'default' };
            
            await new Promise((resolve) => {
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

        // --- 2. NORMALIZE VIDEO (SUPPORT STOP & INTRO) ---
        const normalizeVideo = async (filePath, index, shouldMute, isIntro = false) => {
            if (isStopMerge) return null;
            usedFiles.add(filePath);
            const info = await getVideoInfo(filePath);
            const isVerticalInput = info.width < info.height;
            const tempPath = path.join(workDir, `seg_${index}.mp4`);
            
            let complexFilter = [];
            let baseFilter = '';
            
            if (!isVerticalOutput && config.autoConvert9to16 && isVerticalInput) {
                baseFilter = `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=increase,crop=${targetW}:${targetH},gblur=sigma=80[bg];[0:v]scale=-1:${targetH}:flags=lanczos[fg];[bg][fg]overlay=(W-w)/2:(H-h)/2,setsar=1`;
            } else {
                baseFilter = `[0:v]scale=${targetW}:${targetH}:force_original_aspect_ratio=decrease,pad=${targetW}:${targetH}:(ow-iw)/2:(oh-ih)/2,setsar=1`;
            }

            // Only add overlay if NOT intro
            if (!isIntro && overlayPngPath) {
                baseFilter += `[v_base];[v_base][1:v]overlay=0:0`;
                complexFilter = [baseFilter];
            } else {
                complexFilter = [baseFilter];
            }

            await new Promise((resolve, reject) => {
                const cmd = fluentFfmpeg(filePath);
                if (!isIntro && overlayPngPath) cmd.input(overlayPngPath);
                cmd.complexFilter(complexFilter)
                    .videoCodec('libx264').addOption('-preset', 'veryfast').addOption('-crf', '20').addOption('-r', fps)
                    .audioCodec('aac').addOption('-ar', '44100').addOption('-ac', '2');
                
                if (shouldMute) cmd.audioFilters('volume=0');
                
                if (isStopMerge) { cmd.kill(); reject(new Error("Stopped")); return; }
                cmd.save(tempPath).on('end', resolve).on('error', reject);
            });
            return tempPath;
        };

        let segIdx = 0;
        sendLog(`[MERGE] Start loop... Target: ${targetDuration}s`);

        // --- 2.5 PROCESS INTRO (IF EXISTS) ---
        if (introPath && fs.existsSync(introPath)) {
            sendLog(`[MERGE] Adding Intro: ${path.basename(introPath)}`);
            try {
                // Intro is never muted, never has text overlay
                const introSeg = await normalizeVideo(introPath, segIdx, false, true);
                if (introSeg) {
                    const d = await getDuration(introSeg);
                    tempSegments.push(introSeg);
                    curTime += d; 
                    segIdx++;
                }
            } catch (err) {
                if(isStopMerge) throw new Error("Stopped");
                sendLog(`[WARN] Intro fail: ${err.message}`);
            }
        }

        // --- 3. MAIN LOOP ---
        while(curTime < targetDuration) {
            if (isStopMerge) throw new Error("Stopped");
            let selectedFile = null;
            let type = '';

            if (useOther && curTime >= nextOtherTime) {
                if (filesO.length === 0) filesO = getFilesSafeFull(other).sort(()=>Math.random()-.5);
                selectedFile = filesO.pop();
                type = 'other';
                nextOtherTime += otherInterval;
            } else {
                if (pattern.length === 0) break;
                type = pattern[patternIdx % pattern.length];
                if (type === 'normal') { if (filesN.length === 0) filesN = getFilesSafeFull(normal).sort(()=>Math.random()-.5); selectedFile = filesN.pop(); } 
                else { if (filesV.length === 0) filesV = getFilesSafeFull(voice).sort(()=>Math.random()-.5); selectedFile = filesV.pop(); }
                patternIdx++;
            }

            if (!selectedFile) break;
            sendLog(`[MERGE] Adding ${type}: ${path.basename(selectedFile)}`);
            
            let isMute = (type === 'other' && config.muteOther);
            try {
                let segmentPath = await normalizeVideo(selectedFile, segIdx, isMute, false);
                const d = await getDuration(segmentPath);
                tempSegments.push(segmentPath);
                curTime += d;
                segIdx++;
            } catch(e) { 
                if (isStopMerge) throw e; 
            }
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

        // --- 4. CLEANUP SOURCE ---
        if (deleteSources && !isStopMerge) { 
            sendLog(`[CLEANUP] Deleting ${usedFiles.size} source files...`); 
            const deleteFileSafe = (f, retries = 5) => {
                try {
                    if(fs.existsSync(f)) fs.unlinkSync(f);
                } catch (err) {
                    if (retries > 0) setTimeout(() => deleteFileSafe(f, retries - 1), 200);
                    else sendLog(`[WARN] Could not delete: ${path.basename(f)}`);
                }
            };
            for (const f of usedFiles) deleteFileSafe(f);
        }

        return { success: true, message: "Merge Completed!" };
    } catch(err) { 
        removeDir(workDir); 
        return { success: false, message: err.message }; 
    }
});