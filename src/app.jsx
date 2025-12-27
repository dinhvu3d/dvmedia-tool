import React, { useState, useEffect, useRef } from 'react';
import { 
  FileVideo, Settings, Trash2, Video, Ban, 
  Loader, Download, ChevronDown, RefreshCw, Zap, 
  LayoutTemplate, File, Folder, CheckSquare, Key, Copy, 
  Repeat, Edit3, Filter, Play, Clock, VolumeX, 
  Mic, Save, Cpu, Languages
} from 'lucide-react';

// ==========================================
// 1. SHARED COMPONENTS
// ==========================================

const PathInput = ({ label, placeholder, value, onChange, isFile = false, isSave = false, filters = null }) => {
    const handleSelect = async () => { 
        if(window.electronAPI) { 
            let path;
            if (isSave) path = await window.electronAPI.saveFile(isSave); 
            else path = isFile ? await window.electronAPI.openFile(filters) : await window.electronAPI.openDirectory(); 
            if(path) onChange(path); 
        } 
    };
    return ( <div className="mb-3"> <label className="block text-gray-500 text-xs font-bold mb-1 font-mono uppercase">{label}:</label> <div className="flex gap-2"> <input type="text" className="flex-1 bg-[#1e222b] border border-gray-600 text-gray-300 text-xs rounded px-3 py-2 focus:border-orange-500 focus:text-white transition-colors" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value.replace(/"/g, ''))} /> <button onClick={handleSelect} className={`bg-[#2a2e3b] hover:bg-[#363b4b] border border-gray-600 text-gray-300 px-3 rounded text-xs whitespace-nowrap font-bold flex items-center gap-2`}> {isSave ? <Save size={14}/> : <Folder size={14}/>} Browse</button> </div> </div> );
};

const SidebarItem = ({ icon: Icon, label, isActive, onClick }) => ( <div onClick={onClick} className={`group flex items-center gap-3 px-4 py-3 cursor-pointer transition-all mb-1 ${isActive ? 'bg-[#3d2b1f] text-orange-500 border-l-2 border-orange-500' : 'text-gray-400 hover:bg-[#252a38] hover:text-gray-200'}`}> <Icon size={18} /> <span className="font-medium text-sm">{label}</span> </div> );

const ColorButton = ({ color, onChange, disabled }) => { return ( <div className={`w-full h-[34px] bg-[#2a2e3b] border border-gray-600 rounded flex items-center justify-center cursor-pointer hover:border-gray-400 overflow-hidden relative ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}> <div className="absolute inset-0 opacity-60" style={{ backgroundColor: color }}></div> <span className="relative z-10 text-[10px] font-bold text-white drop-shadow-md uppercase tracking-wider">{color}</span> {!disabled && (<input type="color" value={color} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20" />)} </div> ); };

const UpdateNotificationModal = ({ status, msg, onClose, onConfirm }) => { if (!['available', 'downloading', 'downloaded'].includes(status)) return null; return ( <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"> <div className="bg-[#1e222b] border border-gray-600 rounded-lg shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"> <div className="flex items-center gap-3 border-b border-gray-700 pb-4"> <div className="bg-green-500/20 p-2 rounded-full">{status === 'available' ? <Zap size={24} className="text-green-500" /> : <Loader size={24} className="text-blue-500 animate-spin" />}</div> <div><h3 className="text-lg font-bold text-white">Update Available</h3><p className="text-xs text-gray-400">New version found.</p></div> </div> <div className="bg-[#15171e] p-3 rounded border border-gray-700"><p className="text-sm text-gray-300 font-mono text-center">{msg}</p></div> <div className="flex gap-3 justify-end pt-2"> {status !== 'downloading' && <button onClick={onClose} className="px-4 py-2 rounded text-sm font-bold text-gray-400 hover:bg-gray-700">Later</button>} {status !== 'downloading' && status !== 'downloaded' && <button onClick={onConfirm} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded text-sm font-bold flex gap-2"> <Download size={16} /> Update </button>} {(status === 'downloading' || status === 'downloaded') && <button disabled className="w-full bg-blue-600/50 text-white px-6 py-2 rounded text-sm font-bold flex justify-center gap-2 cursor-wait"> <Loader size={16} className="animate-spin" /> Updating... </button>} </div> </div> </div> ); };

const ActivationScreen = ({ onActivated }) => { const [keyInput, setKeyInput] = useState(''); const [machineId, setMachineId] = useState('Loading...'); const [msg, setMsg] = useState(''); const [loading, setLoading] = useState(false); useEffect(() => { if(window.electronAPI) window.electronAPI.getMachineId().then(setMachineId); }, []); const handleSubmit = async () => { if (!keyInput.trim()) return setMsg("Enter Key!"); setLoading(true); if (window.electronAPI) { const res = await window.electronAPI.activateLicense(keyInput); if (res.success) onActivated(); else setMsg(res.message); } setLoading(false); }; return ( <div className="flex flex-col items-center justify-center h-screen w-full bg-[#11141c] text-white"> <div className="w-[450px] bg-[#1e222b] p-8 rounded-xl border border-gray-700 shadow-2xl"> <div className="flex justify-center mb-4"><div className="bg-orange-500/20 p-4 rounded-full"><Key size={40} className="text-orange-500" /></div></div> <h2 className="text-2xl font-bold text-center mb-6">License Activation</h2> <div className="bg-[#15171e] p-3 rounded border border-gray-600 mb-6"><label className="block text-gray-500 text-[10px] font-bold uppercase mb-1">HWID:</label><div className="flex items-center gap-2"><code className="flex-1 text-green-400 font-mono text-center text-sm font-bold tracking-wider">{machineId}</code><button onClick={() => navigator.clipboard.writeText(machineId)} className="p-1 hover:bg-gray-700 rounded"><Copy size={14} /></button></div></div> <input type="text" value={keyInput} onChange={(e) => setKeyInput(e.target.value)} placeholder="XXXX-XXXX-XXXX-XXXX" className="w-full bg-[#15171e] border border-gray-600 text-white p-3 rounded mb-4 focus:border-orange-500 text-center font-mono font-bold tracking-widest uppercase" /> {msg && <div className="text-red-500 text-sm text-center mb-4 font-bold">{msg}</div>} <button onClick={handleSubmit} disabled={loading} className="w-full bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 text-white font-bold py-3 rounded shadow-lg flex justify-center gap-2"> {loading ? <Loader className="animate-spin" /> : "ACTIVATE"} </button> </div> </div> ); };

// ==========================================
// 2. TABS CONTENT
// ==========================================

const RenameTab = () => { 
    // AUTO SAVE LOGIC
    const [inputPath, setInputPath] = useState(localStorage.getItem('rn_in') || ''); 
    const [outputPath, setOutputPath] = useState(localStorage.getItem('rn_out') || ''); 
    
    useEffect(() => localStorage.setItem('rn_in', inputPath), [inputPath]);
    useEffect(() => localStorage.setItem('rn_out', outputPath), [outputPath]);

    const [logs, setLogs] = useState([]); 
    const [isRunning, setIsRunning] = useState(false); 
    
    useEffect(() => { if(window.electronAPI) window.electronAPI.onSystemLog(msg => setLogs(p => [msg, ...p])); }, []); 
    
    const handleStart = async () => { if (!inputPath || !outputPath) return alert("Missing Path!"); setIsRunning(true); setLogs([]); if(window.electronAPI) { const res = await window.electronAPI.rename({ inputDir: inputPath, outputDir: outputPath }); alert(res.message); } setIsRunning(false); }; 
    const handleStop = async () => { if(window.electronAPI) await window.electronAPI.stopRename(); }; 
    
    return ( <div className="max-w-3xl mx-auto"> <div className="grid grid-cols-2 gap-4 mb-4"><PathInput label="Input" value={inputPath} onChange={setInputPath} /><PathInput label="Output" value={outputPath} onChange={setOutputPath} /></div> <div className="flex justify-center gap-4 mb-4"> <button onClick={handleStart} disabled={isRunning} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded text-sm font-bold flex gap-2 disabled:opacity-50">{isRunning ? <Loader className="animate-spin" size={16}/> : <Edit3 size={16}/>} Rename</button> {isRunning && <button onClick={handleStop} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded text-sm font-bold flex gap-2"><Ban size={16}/> Stop</button>} </div> <div className="bg-[#161922] border border-gray-700 h-64 overflow-y-auto p-2 text-xs font-mono text-gray-400 custom-scrollbar">{logs.map((l, i) => <div key={i} className="mb-0.5">{l}</div>)}</div> </div> ); 
};

const DedupTab = () => {
    // AUTO SAVE LOGIC
    const [delFolder, setDelFolder] = useState(localStorage.getItem('dd_del_folder') || '');
    const [delDuration, setDelDuration] = useState(localStorage.getItem('dd_del_duration') || 2);
    const [dedupFolder, setDedupFolder] = useState(localStorage.getItem('dd_dedup_folder') || '');

    useEffect(() => localStorage.setItem('dd_del_folder', delFolder), [delFolder]);
    useEffect(() => localStorage.setItem('dd_del_duration', delDuration), [delDuration]);
    useEffect(() => localStorage.setItem('dd_dedup_folder', dedupFolder), [dedupFolder]);

    const [isDeleting, setIsDeleting] = useState(false);
    const [delProgress, setDelProgress] = useState({ current: 0, total: 0 });
    const [dedupProgress, setDedupProgress] = useState({ phase: 'Idle', current: 0, total: 0, msg: '' });
    const [isScanning, setIsScanning] = useState(false);
    const [logs, setLogs] = useState([]);

    useEffect(() => {
        let cleanLog;
        let cleanProgress;

        if(window.electronAPI) {
            cleanLog = window.electronAPI.onSystemLog(msg => setLogs(p => [msg, ...p]));
            if (window.electronAPI.onDedupProgress) {
                cleanProgress = window.electronAPI.onDedupProgress((data) => {
                    setDedupProgress({
                        phase: data.phase || 'Processing',
                        current: data.current || 0,
                        total: data.total || 0,
                        msg: data.msg || ''
                    });
                });
            }
        }
        return () => { 
            if(cleanLog) cleanLog(); 
            if(cleanProgress) cleanProgress();
        };
    }, []);

    const handleDelete = async () => {
        if (!delFolder) return alert('Select folder!');
        setIsDeleting(true); setLogs([]);
        if(window.electronAPI) {
            const res = await window.electronAPI.deleteShort({ targetDir: delFolder, minDuration: delDuration });
            alert(res.message);
        }
        setIsDeleting(false); setDelProgress({current: 0, total: 0});
    };

    const handleDedup = async () => {
        if (!dedupFolder) return alert("Select folder!");
        setIsScanning(true); setLogs([]);
        if (window.electronAPI) {
            const res = await window.electronAPI.startDedup({ folderPath: dedupFolder });
            alert(res.message || "Operation completed.");
        }
        setIsScanning(false);
    };

    return (
        <div className="flex gap-6 h-full pb-4">
            <div className="w-1/2 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-2">
                {/* DELETE SHORT SECTION */}
                <div className="bg-[#1e222b] p-5 rounded border border-gray-700 shadow-md">
                    <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2"><Trash2 className="text-red-500" size={18}/> Delete Short Videos</h3>
                    <PathInput label="Target Folder" value={delFolder} onChange={setDelFolder} />
                    <div className="flex items-center gap-3 mb-4">
                        <span className="text-xs text-gray-400 font-bold">Min Duration (sec):</span>
                        <input type="number" value={delDuration} onChange={(e)=>setDelDuration(e.target.value)} className="w-16 bg-[#2a2e3b] text-white text-center border border-gray-600 rounded p-1"/>
                    </div>
                    <div className="flex gap-3">
                        <button onClick={handleDelete} disabled={isDeleting} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                            {isDeleting ? <Loader className="animate-spin" size={14}/> : <Trash2 size={14}/>} {isDeleting ? `Scanning ${delProgress.current}/${delProgress.total}` : "DELETE FILES"}
                        </button>
                        {isDeleting && <button onClick={()=>window.electronAPI.stopDelete()} className="bg-gray-600 hover:bg-gray-700 px-4 rounded text-white text-xs font-bold">STOP</button>}
                    </div>
                </div>

                {/* DEDUP SECTION */}
                <div className="bg-[#1e222b] p-5 rounded border border-gray-700 shadow-md flex-1">
                    <h3 className="text-sm font-bold text-gray-300 mb-4 flex items-center gap-2"><Filter className="text-orange-500" size={18}/> Duplicate Finder</h3>
                    <PathInput label="Target Folder" value={dedupFolder} onChange={setDedupFolder} />
                    <div className="mt-4">
                        {isScanning ? (
                            <div className="mb-4">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span className="uppercase font-bold text-orange-400">{dedupProgress.phase}</span>
                                    <span>{dedupProgress.current} / {dedupProgress.total}</span>
                                </div>
                                <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden">
                                    <div className="bg-orange-500 h-full transition-all duration-300" style={{ width: `${(dedupProgress.current / (dedupProgress.total || 1)) * 100}%` }}></div>
                                </div>
                                <p className="text-[10px] text-gray-500 mt-1 truncate">{dedupProgress.msg}</p>
                            </div>
                        ) : null}
                        <div className="flex gap-3">
                            <button onClick={handleDedup} disabled={isScanning} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                {isScanning ? <Loader className="animate-spin" size={14}/> : <Play size={14}/>} {isScanning ? "SCANNING..." : "START SCAN"}
                            </button>
                            {isScanning && <button onClick={()=>window.electronAPI.stopDedup()} className="bg-gray-600 hover:bg-gray-700 px-4 rounded text-white text-xs font-bold">STOP</button>}
                        </div>
                    </div>
                </div>
            </div>

            {/* LOGS */}
            <div className="w-1/2 bg-[#161922] border border-gray-700 rounded p-3 flex flex-col h-full">
                <div className="flex justify-between items-center mb-2 pb-2 border-b border-gray-800">
                    <h3 className="text-xs font-bold text-gray-400 uppercase">Process Logs</h3>
                </div>
                <div className="flex-1 overflow-y-auto custom-scrollbar font-mono text-[10px] text-gray-400">
                    {logs.map((l, i) => <div key={i} className={`mb-0.5 border-b border-gray-800/50 pb-0.5 ${l.includes('[MATCH]')?'text-green-400 font-bold':''} ${l.includes('[DELETED]')?'text-red-400':''}`}>{l}</div>)}
                </div>
            </div>
        </div>
    );
};

const Convert9to16Tab = () => { 
    // AUTO SAVE LOGIC
    const [mode, setMode] = useState(localStorage.getItem('cv_mode') || 'folder'); 
    const [inputPath, setInputPath] = useState(localStorage.getItem('cv_input') || ''); 
    const [outputFile, setOutputFile] = useState(localStorage.getItem('cv_output') || ''); 
    const [blurLevel, setBlurLevel] = useState('Medium'); 
    const [resolution, setResolution] = useState(localStorage.getItem('cv_res') || '1920x1080_AV1_30');
    const [encoder, setEncoder] = useState(localStorage.getItem('cv_encoder') || 'libx264'); 
    
    useEffect(() => localStorage.setItem('cv_mode', mode), [mode]);
    useEffect(() => localStorage.setItem('cv_input', inputPath), [inputPath]);
    useEffect(() => localStorage.setItem('cv_output', outputFile), [outputFile]);
    useEffect(() => localStorage.setItem('cv_res', resolution), [resolution]);
    useEffect(() => localStorage.setItem('cv_encoder', encoder), [encoder]);

    const [logs, setLogs] = useState([]); 
    const [isRunning, setIsRunning] = useState(false); 
    
    useEffect(() => {
        let cleanLog;
        if(window.electronAPI) {
            cleanLog = window.electronAPI.onSystemLog(msg => setLogs(p => [msg, ...p]));
        }
        return () => { if(cleanLog) cleanLog(); };
    }, []);

    const handleSelectOutput = async () => { 
        if(window.electronAPI) { 
            let filePath;
            if (mode === 'folder') {
                filePath = await window.electronAPI.openDirectory();
            } else {
                filePath = await window.electronAPI.saveFile();
            }
            if(filePath) setOutputFile(filePath); 
        } 
    }; 
    
    const handleStart = async () => { 
        if (!inputPath) return alert("Missing Input!"); 
        if (!outputFile && mode === 'file') return alert("Missing Output!");
        
        setIsRunning(true); setLogs([]); 
        if(window.electronAPI) { 
            const res = await window.electronAPI.convert9to16({ inputType: mode, inputPath, outputFile, blurLevel, resolution, encoder }); 
            alert(res.message); 
        } 
        setIsRunning(false); 
    }; 
    
    const handleStop = async () => { if(window.electronAPI) await window.electronAPI.stopConvert9to16(); }; 
    
    return ( 
        <div className="max-w-3xl mx-auto"> 
            <div className="flex gap-4 mb-4"> 
                <button onClick={() => { setMode('folder'); setInputPath(''); setOutputFile(''); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded border font-bold ${mode === 'folder' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1e222b] border-gray-600 text-gray-400'}`}> <Folder size={18} /> Batch </button> 
                <button onClick={() => { setMode('file'); setInputPath(''); setOutputFile(''); }} className={`flex-1 flex items-center justify-center gap-2 py-3 rounded border font-bold ${mode === 'file' ? 'bg-blue-600 border-blue-500 text-white' : 'bg-[#1e222b] border-gray-600 text-gray-400'}`}> <File size={18} /> Single </button> 
            </div> 
            <div className="bg-[#1e222b] p-4 rounded border border-gray-700 mb-4"> 
                <PathInput label={mode === 'folder' ? 'Input Folder' : 'Input File'} value={inputPath} onChange={setInputPath} isFile={mode === 'file'} /> 
                <div className="mt-3"> 
                    <label className="block text-gray-500 text-xs font-bold mb-1 font-mono uppercase">{mode === 'folder' ? 'Output Folder (Optional)' : 'Output File'}:</label> 
                    <div className="flex gap-2"> 
                        <input type="text" value={outputFile} onChange={(e) => setOutputFile(e.target.value)} className="flex-1 bg-[#2a2e3b] border border-gray-600 text-white text-xs rounded px-3 py-2" placeholder={mode === 'folder' ? 'Leave empty to create "converted" inside input folder' : ''} /> 
                        <button onClick={handleSelectOutput} className="bg-orange-700 hover:bg-orange-600 text-white text-xs px-3 py-2 rounded font-bold">Browse</button> 
                    </div> 
                </div>
                <div className="mt-3">
                    <label className="block text-gray-500 text-xs font-bold mb-1 font-mono uppercase">Render Engine:</label> 
                    <select value={encoder} onChange={(e) => setEncoder(e.target.value)} className="w-full bg-[#2a2e3b] border border-gray-600 text-white text-xs rounded px-3 py-2 font-bold outline-none">
                        <option value="libx264">CPU (Stable)</option>
                        <option value="h264_nvenc">NVIDIA GPU</option>
                        <option value="h264_amf">AMD GPU</option>
                        <option value="h264_qsv">INTEL GPU</option>
                    </select>
                </div> 
            </div> 
            <div className="flex justify-center gap-4 mb-4"> 
                <button onClick={handleStart} disabled={isRunning} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded text-sm font-bold flex items-center gap-2 disabled:opacity-50"> {isRunning ? <Loader className="animate-spin" size={16}/> : <LayoutTemplate size={16}/>} Start </button> 
                {isRunning && <button onClick={handleStop} className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded text-sm font-bold">Stop</button>} 
            </div> 
            <div className="bg-[#161922] border border-gray-700 h-64 overflow-y-auto p-2 text-xs font-mono text-gray-400 custom-scrollbar"> {logs.map((l, i) => <div key={i} className="mb-0.5">{l}</div>)} </div> 
        </div> 
    ); 
};

// --- MIX VIDEO TAB (OLD MERGE TAB - RENAMED & RESTORED) ---
const MixVideoTab = () => {
    // 1. Config Init
    const defaultConfig = { 
        counts: { normal: 3, voice: 1, other: 1 }, 
        duration: 10, 
        resolution: '1920x1080_H264_30', 
        autoConvert9to16: false, 
        otherInterval: 2, 
        otherStart: 0, 
        muteOther: false, 
        enableOther: false,
        encoder: 'libx264' // THÊM MẶC ĐỊNH
    };

    const [config, setConfig] = useState(() => {
        try {
            const saved = localStorage.getItem('mg_config');
            return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
        } catch { return defaultConfig; }
    });

    const [paths, setPaths] = useState(() => {
        try {
            const saved = localStorage.getItem('mg_paths');
            return saved ? JSON.parse(saved) : { normal: '', voice: '', other: '', intro: '', output: '' };
        } catch { return { normal: '', voice: '', other: '', intro: '', output: '' }; }
    });

    const defaultOverlay = { enabled: true, text1: 'Line 1', text2: 'Line 2', size: 35, padding: 10, color: '#FFFFFF', enableStroke: true, strokeColor: '#000000', enableBg: true, bgColor: '#FF5733' };
    const [overlay, setOverlay] = useState(() => {
        try {
            const saved = localStorage.getItem('mg_overlay');
            return saved ? { ...defaultOverlay, ...JSON.parse(saved) } : defaultOverlay;
        } catch { return defaultOverlay; }
    });

    const [deleteSources, setDeleteSources] = useState(() => {
        return localStorage.getItem('mg_delete_sources') === 'true';
    });

    // 2. Save Effects
    useEffect(() => { localStorage.setItem('mg_config', JSON.stringify(config)); }, [config]);
    useEffect(() => { localStorage.setItem('mg_paths', JSON.stringify(paths)); }, [paths]);
    useEffect(() => { localStorage.setItem('mg_overlay', JSON.stringify(overlay)); }, [overlay]);
    useEffect(() => { localStorage.setItem('mg_delete_sources', deleteSources); }, [deleteSources]);

    const [logs, setLogs] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);

    useEffect(() => {
        let cleanLog;
        if(window.electronAPI) {
            cleanLog = window.electronAPI.onSystemLog(msg => setLogs(p => [msg, ...p]));
        }
        return () => { if(cleanLog) cleanLog(); };
    }, []);

    useEffect(() => {
        setConfig(prev => ({ ...prev, enableOther: !!paths.other }));
    }, [paths.other]);

    const handleResolutionChange = (e) => {
        const val = e.target.value;
        setConfig(prev => ({ ...prev, resolution: val }));
    };

    const handleCount = (type, val) => {
        const v = parseInt(val) || 0;
        setConfig(prev => ({ ...prev, counts: { ...prev.counts, [type]: v } }));
    };

    const handleSelectOutput = async () => { 
        if(window.electronAPI) { 
            const filePath = await window.electronAPI.saveFile(); 
            if(filePath) setPaths(p => ({...p, output: filePath})); 
        } 
    };

    const handleCheckMax = async () => { 
        if (!paths.normal && !paths.voice && !paths.other) return alert("Select source!"); 
        if (window.electronAPI) { 
            const res = await window.electronAPI.checkMax({ inputDirs: paths, config }); 
            alert(res.message); 
        } 
    };

    const handleStopMerge = async () => {
        if(window.electronAPI) await window.electronAPI.stopMerge();
    };

    const handleMergeOne = async () => { 
        if (!paths.output) return alert("Missing Output!"); 
        setIsProcessing(true); setLogs([]); 
        if (window.electronAPI) { 
            const res = await window.electronAPI.merge({ 
                inputDirs: paths, 
                outputFile: paths.output, 
                config, 
                overlayConfig: overlay, 
                deleteSources,
                introPath: paths.intro 
            }); 
            alert(res.message); 
        } 
        setIsProcessing(false); 
    };

    const handleMergeAll = async () => { 
        if (!paths.output) return alert("Missing Output!"); 
        setIsProcessing(true); 
        setLogs(p => ["--- BATCH STARTED ---", ...p]); 
        try { 
            const checkRes = await window.electronAPI.checkMax({ inputDirs: paths, config }); 
            if (checkRes.maxCount <= 0) { alert("Not enough materials!"); setIsProcessing(false); return; } 
            
            const outputDir = paths.output.substring(0, paths.output.lastIndexOf('\\')); 
            const baseName = paths.output.substring(paths.output.lastIndexOf('\\') + 1, paths.output.lastIndexOf('.')); 
            
            for (let i = 1; i <= checkRes.maxCount; i++) { 
                const currentOutput = `${outputDir}\\${baseName}_${i}.mp4`; 
                setLogs(p => [`>>> Video ${i}/${checkRes.maxCount}...`, ...p]); 
                const res = await window.electronAPI.merge({ 
                    inputDirs: paths, 
                    outputFile: currentOutput, 
                    config, 
                    overlayConfig: overlay, 
                    deleteSources,
                    introPath: paths.intro
                }); 
                
                if (!res.success) { 
                    if(res.message.includes("Stopped")) {
                        setLogs(p => ["--- STOPPED BY USER ---", ...p]);
                        break; 
                    }
                    else { alert(`Error: ${res.message}`); break; }
                } 
            } 
            if(!logs[0]?.includes("STOPPED")) alert(`Done batch!`); 
        } catch (error) { alert("Error: " + error.message); } 
        setIsProcessing(false); 
    };

    return (
        <div className="max-w-4xl mx-auto flex gap-6 h-full pb-4">
            <div className="w-1/2 flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar pr-1">
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700"> 
                    <PathInput label="Normal Clips Folder" value={paths.normal} onChange={(v)=>setPaths(p=>({...p, normal: v}))} /> 
                    <PathInput label="Voice Clips Folder" value={paths.voice} onChange={(v)=>setPaths(p=>({...p, voice: v}))} /> 
                    <PathInput label="Other Clips Folder" value={paths.other} onChange={(v)=>setPaths(p=>({...p, other: v}))} /> 
                    
                    {/* INTRO INPUT */}
                    <div className="mt-4 pt-3 border-t border-gray-700">
                        <PathInput label="Intro Video (Optional - Runs First)" value={paths.intro} onChange={(v)=>setPaths(p=>({...p, intro: v}))} isFile={true} />
                    </div>
                </div>
                
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700"> 
                    <label className="block text-gray-500 text-xs font-bold mb-2 uppercase">Output Format:</label> 
                    <select value={config.resolution} onChange={handleResolutionChange} className="w-full bg-[#2a2e3b] border border-gray-600 text-white rounded p-2 text-sm outline-none mb-3 font-bold"> 
                        <option value="1920x1080_H264_30">16:9 - 1080p 30fps</option> 
                        <option value="1920x1080_H264_60">16:9 - 1080p 60fps</option> 
                        <option value="1280x720_H264_30">16:9 - 720p 30fps</option> 
                        <option disabled>──────────</option>
                        <option value="1080x1920_H264_30">9:16 - 1080p 30fps</option>
                        <option value="1080x1920_H264_60">9:16 - 1080p 60fps</option>
                        <option value="720x1280_H264_30">9:16 - 720p 30fps</option>
                    </select> 
                    
                    {/* CHECKBOX: AUTO CONVERT */}
                    <div 
                        className="flex items-center gap-2 mb-3 cursor-pointer group"
                        onClick={() => setConfig(prev => ({...prev, autoConvert9to16: !prev.autoConvert9to16}))}
                    > 
                        <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${config.autoConvert9to16 ? 'bg-green-600 border-green-500' : 'border-gray-500 bg-[#15171e]'}`}> 
                            {config.autoConvert9to16 && <CheckSquare size={12} className="text-white" />} 
                        </div> 
                        <span className={`text-xs font-bold ${config.autoConvert9to16 ? 'text-green-400' : 'text-gray-400 group-hover:text-gray-300'}`}> Auto Fill Background (Blur) </span> 
                    </div> 
                    
                    <label className="block text-gray-500 text-xs font-bold mb-1 uppercase">Output File:</label> 
                    <div className="flex gap-2"> 
                        <input type="text" value={paths.output} onChange={(e) => setPaths(p => ({...p, output: e.target.value}))} className="flex-1 bg-[#2a2e3b] border border-gray-600 text-white text-xs rounded px-2" placeholder="e.g. D:\Videos\Final.mp4"/> 
                        <button onClick={handleSelectOutput} className="bg-orange-700 hover:bg-orange-600 text-white text-xs px-3 py-2 rounded font-bold">Browse</button> 
                    </div> 
                </div>
                    <label className="block text-gray-500 text-xs font-bold mb-1 uppercase">Render Engine:</label> 
                    <select 
                        value={config.encoder || 'libx264'} 
                        onChange={(e) => setConfig(prev => ({...prev, encoder: e.target.value}))} 
                        className="w-full bg-[#2a2e3b] border border-gray-600 text-white rounded p-2 text-sm outline-none mb-3 font-bold"
                    > 
                        <option value="libx264">CPU (Stable)</option> 
                        <option value="h264_nvenc">NVIDIA GPU</option> 
                        <option value="h264_amf">AMD GPU</option> 
                        <option value="h264_qsv">INTEL GPU</option> 
                    </select> 
                    
                    <label className="block text-gray-500 text-xs font-bold mb-1 uppercase">Output File:</label>

                <div className="bg-[#1e222b] p-3 rounded border border-gray-700 flex flex-col gap-2"> 
                    <div className="flex items-center justify-between pb-1 border-b border-gray-700 mb-1"> 
                        <div className="flex items-center gap-2 cursor-pointer" onClick={() => setOverlay(p => ({...p, enabled: !p.enabled}))}> 
                            <div className={`w-4 h-4 border rounded flex items-center justify-center ${overlay.enabled ? 'bg-orange-600 border-orange-500' : 'bg-[#15171e] border-gray-500'}`}> {overlay.enabled && <CheckSquare size={12} className="text-white" />} </div> 
                            <span className={`text-sm font-bold uppercase ${overlay.enabled ? 'text-orange-500' : 'text-gray-400'}`}>Text Overlay</span> 
                        </div> 
                    </div> 
                    <div className={`flex flex-col gap-2 transition-opacity ${!overlay.enabled && 'opacity-50 pointer-events-none'}`}> 
                        <div className="flex items-center gap-2"> <span className="text-[10px] text-gray-500 font-bold uppercase w-8">Line 1</span> <input type="text" value={overlay.text1} onChange={(e) => setOverlay({...overlay, text1: e.target.value.replace(/\r/g, '')})} className="flex-1 bg-[#2a2e3b] border border-gray-600 text-white text-sm rounded px-2 py-1 focus:border-orange-500" placeholder="Top line..." /> </div>
                        <div className="flex items-center gap-2"> <span className="text-[10px] text-gray-500 font-bold uppercase w-8">Line 2</span> <input type="text" value={overlay.text2} onChange={(e) => setOverlay({...overlay, text2: e.target.value.replace(/\r/g, '')})} className="flex-1 bg-[#2a2e3b] border border-gray-600 text-white text-sm rounded px-2 py-1 focus:border-orange-500" placeholder="Bottom line..." /> </div>
                        <div className="grid grid-cols-5 gap-2 mt-1">
                            <div><div className="text-[9px] text-gray-500 uppercase font-bold mb-1 text-center h-4 flex items-center justify-center">Size</div><input type="number" value={overlay.size} onChange={(e)=>setOverlay({...overlay, size: parseInt(e.target.value)||10})} className="w-full bg-[#2a2e3b] border border-gray-600 text-white text-center rounded p-1 text-xs font-bold h-[34px]"/></div>
                            <div><div className="text-[9px] text-gray-500 uppercase font-bold mb-1 text-center h-4 flex items-center justify-center">Pad</div><input type="number" value={overlay.padding} onChange={(e)=>setOverlay({...overlay, padding: parseInt(e.target.value)||0})} className="w-full bg-[#2a2e3b] border border-gray-600 text-white text-center rounded p-1 text-xs font-bold h-[34px]"/></div>
                            <div><div className="text-[9px] text-gray-500 uppercase font-bold mb-1 text-center h-4 flex items-center justify-center">Text</div><ColorButton color={overlay.color} onChange={(c)=>setOverlay({...overlay, color: c})} /></div>
                            <div><div className="text-[9px] text-gray-500 uppercase font-bold mb-1 text-center h-4 flex items-center justify-center gap-1 cursor-pointer" onClick={()=>setOverlay(p=>({...p, enableStroke:!p.enableStroke}))}><span>Stroke</span><div className={`w-3 h-3 border rounded flex items-center justify-center ${overlay.enableStroke ? 'bg-orange-500 border-orange-500' : 'bg-[#15171e] border-gray-500'}`}>{overlay.enableStroke && <CheckSquare size={10} className="text-white" />}</div></div><ColorButton color={overlay.strokeColor} onChange={(c)=>setOverlay({...overlay, strokeColor: c})} disabled={!overlay.enableStroke} /></div>
                            <div><div className="text-[9px] text-gray-500 uppercase font-bold mb-1 text-center h-4 flex items-center justify-center gap-1 cursor-pointer" onClick={()=>setOverlay(p=>({...p, enableBg:!p.enableBg}))}><span>Box</span><div className={`w-3 h-3 border rounded flex items-center justify-center ${overlay.enableBg ? 'bg-orange-500 border-orange-500' : 'bg-[#15171e] border-gray-500'}`}>{overlay.enableBg && <CheckSquare size={10} className="text-white" />}</div></div><ColorButton color={overlay.bgColor} onChange={(c)=>setOverlay({...overlay, bgColor: c})} disabled={!overlay.enableBg} /></div>
                        </div>
                    </div> 
                </div> 
            </div>

            <div className="w-1/2 flex flex-col gap-3"> 
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700"> 
                    <div className="flex justify-between items-center mb-3"> <span className="text-gray-400 text-sm font-bold">Merge Pattern</span> <div className="flex items-center gap-2"><span className="text-xs text-gray-500">Duration (min):</span><input type="number" value={config.duration} onChange={(e)=>setConfig({...config, duration: parseInt(e.target.value)||1})} className="w-12 bg-[#2a2e3b] border border-gray-600 text-white text-center rounded p-1 text-sm font-bold"/></div> </div> 
                    <div className="grid grid-cols-2 gap-4 mb-3">
                        <div><span className="text-xs text-gray-500 block mb-1 uppercase font-bold">Normal Ratio:</span><input type="number" min="0" value={paths.normal ? config.counts.normal : 0} disabled={!paths.normal} onChange={(e)=>handleCount('normal', e.target.value)} className="w-full border text-center rounded p-2 bg-[#2a2e3b] border-gray-600 text-white font-bold"/></div> 
                        <div><span className="text-xs text-gray-500 block mb-1 uppercase font-bold">Voice Ratio:</span><input type="number" min="0" value={paths.voice ? config.counts.voice : 0} disabled={!paths.voice} onChange={(e)=>handleCount('voice', e.target.value)} className="w-full border text-center rounded p-2 bg-[#2a2e3b] border-gray-600 text-white font-bold"/></div> 
                    </div> 
                    
                    <div className={`mb-4 p-3 rounded border border-gray-600 transition-all ${config.enableOther ? 'bg-[#252a38] opacity-100' : 'bg-[#1e222b] opacity-50'}`}> 
                        <div className="flex items-center justify-between mb-2"> 
                            <div className="flex items-center gap-2"><Clock size={16} className="text-orange-400"/><span className="text-xs text-gray-300 font-bold uppercase">Other Clips Settings</span></div> 
                            <div className={`w-8 h-4 rounded-full p-0.5 transition-colors ${config.enableOther ? 'bg-green-600' : 'bg-gray-600'}`}> <div className={`w-3 h-3 bg-white rounded-full shadow-md transform transition-transform ${config.enableOther ? 'translate-x-4' : 'translate-x-0'}`}></div> </div> 
                        </div> 
                        <div className={`flex flex-col gap-3 mt-2 transition-all ${config.enableOther ? 'pointer-events-auto' : 'pointer-events-none'}`}> 
                            <div className="grid grid-cols-2 gap-3"> 
                                <div><span className="text-[10px] text-gray-400 block mb-1">Interval (Min):</span><input type="number" step="0.5" min="0.5" value={config.otherInterval} onChange={(e)=>setConfig({...config, otherInterval: parseFloat(e.target.value) || 1})} className="w-full bg-[#15171e] border border-gray-600 text-white text-center rounded p-1 text-sm font-bold"/></div> 
                                <div><span className="text-[10px] text-gray-400 block mb-1">Start Offset (Min):</span><input type="number" step="0.5" min="0" value={config.otherStart} onChange={(e)=>setConfig({...config, otherStart: parseFloat(e.target.value) || 0})} className="w-full bg-[#15171e] border border-gray-600 text-white text-center rounded p-1 text-sm font-bold"/></div> 
                            </div> 
                            <div className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-600 rounded p-1.5 hover:bg-[#323642]" onClick={() => setConfig(p => ({...p, muteOther: !p.muteOther}))}> <div className={`w-4 h-4 border rounded flex items-center justify-center transition-all ${config.muteOther ? 'bg-red-600 border-red-500' : 'bg-[#15171e] border-gray-500'}`}> {config.muteOther && <CheckSquare size={12} className="text-white" />} </div> <div className="flex items-center gap-1"><VolumeX size={12} className={config.muteOther ? 'text-red-400' : 'text-gray-500'}/><span className={`text-[10px] font-bold uppercase ${config.muteOther ? 'text-red-400' : 'text-gray-500'}`}>Mute Audio for Other Clips</span></div> </div> 
                        </div> 
                    </div> 
                    
                    <div className="mb-4"> <div className="flex items-center gap-2 cursor-pointer group p-2 rounded hover:bg-[#252a38] border border-dashed border-gray-700 hover:border-red-500" onClick={() => setDeleteSources(!deleteSources)}> <div className={`w-5 h-5 border rounded flex items-center justify-center transition-all ${deleteSources ? 'bg-red-600 border-red-500' : 'bg-[#15171e] border-gray-500'}`}> {deleteSources && <CheckSquare size={14} className="text-white" />} </div> <div> <span className={`text-xs font-bold ${deleteSources ? 'text-red-400' : 'text-gray-400 group-hover:text-gray-300'}`}> Auto Delete Source Files After Merge</span> <p className="text-[10px] text-gray-500 mt-0.5">Warning: Original files will be permanently deleted.</p> </div> </div> </div> 
                    
                    <div className="flex gap-2 mb-3"> 
                        <button onClick={handleCheckMax} disabled={isProcessing} className="flex-1 bg-[#2a2e3b] hover:bg-[#363b4b] border border-gray-500 text-orange-400 py-2 rounded text-xs font-bold disabled:opacity-50">Analyze</button> 
                        <button onClick={handleMergeOne} disabled={isProcessing} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded text-xs font-bold disabled:opacity-50">Merge One</button> 
                    </div> 
                    
                    <div className="flex gap-2">
                        <button onClick={handleMergeAll} disabled={isProcessing} className="flex-1 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 text-white py-3 rounded text-sm font-bold disabled:opacity-50 flex justify-center items-center gap-2 shadow-lg">
                            {isProcessing ? <Loader className="animate-spin" size={16}/> : <Repeat size={16}/>} {isProcessing ? "PROCESSING..." : "MERGE ALL"}
                        </button>
                        {isProcessing && (
                            <button onClick={handleStopMerge} className="bg-red-800 hover:bg-red-900 text-white px-4 rounded font-bold border border-red-500 animate-pulse">STOP</button>
                        )}
                    </div>
                </div> 
                <div className="flex-1 bg-[#161922] border border-gray-700 rounded p-2 overflow-y-auto text-xs font-mono text-gray-400 custom-scrollbar">{logs.map((l, i) => <div key={i} className="mb-0.5">{l}</div>)}</div> 
            </div>
        </div>
    );
};

// --- NEW MERGE TAB (ONE-CLICK FLOW + GPU SUPPORT) ---
const SyncVideoTab = () => {
    // 1. STATE & CONFIG
    const [inputs, setInputs] = useState(() => {
        try { return JSON.parse(localStorage.getItem('sv_inputs')) || { videoPath: '', audioPath: '', srtPath: '', outputPath: '' }; } 
        catch { return { videoPath: '', audioPath: '', srtPath: '', outputPath: '' }; }
    });

    const [config, setConfig] = useState(() => {
        try { return JSON.parse(localStorage.getItem('sv_config')) || { bgVolume: 20, syncSpeed: true, encoder: 'libx264' }; } 
        catch { return { bgVolume: 20, syncSpeed: true, encoder: 'libx264' }; }
    });

    // status: 'idle', 'analyzing', 'rendering'
    const [status, setStatus] = useState('idle'); 
    const [logs, setLogs] = useState([]); 
    const [progress, setProgress] = useState(0); 

    useEffect(() => { localStorage.setItem('sv_inputs', JSON.stringify(inputs)); }, [inputs]);
    useEffect(() => { localStorage.setItem('sv_config', JSON.stringify(config)); }, [config]);

    // LISTENERS
    useEffect(() => {
        let cleanSync, cleanRender;
        if (window.electronAPI) {
            if (window.electronAPI.onSyncProgress) {
                cleanSync = window.electronAPI.onSyncProgress((data) => {
                    if(data.percent) setProgress(data.percent);
                    if(data.step) setLogs(prev => [data.step, ...prev]);
                });
            }
            if (window.electronAPI.onRenderProgress) {
                cleanRender = window.electronAPI.onRenderProgress((data) => {
                    if(data.percent) setProgress(data.percent);
                    if(data.step) setLogs(prev => [data.step, ...prev]);
                });
            }
        }
        return () => { if(cleanSync) cleanSync(); if(cleanRender) cleanRender(); };
    }, []);

    // HANDLERS
    const handleSetInput = (key, value) => setInputs(prev => ({ ...prev, [key]: value }));
    const handleSelectOutput = async () => {
        if (window.electronAPI) {
            const path = await window.electronAPI.saveFile();
            if (path) handleSetInput('outputPath', path);
        }
    };

    const handleStop = async () => {
        if (window.electronAPI) {
            if (status === 'analyzing') await window.electronAPI.stopAnalyzeSync(); 
            if (status === 'rendering') await window.electronAPI.stopRenderSync();  
        }
        setLogs(prev => ["--- STOPPED BY USER ---", ...prev]);
        setStatus('idle');
        setProgress(0);
    };

    // --- ONE-CLICK PROCESS ---
    const handleStartProcess = async () => {
        if (!inputs.videoPath || !inputs.audioPath || !inputs.srtPath) return alert("Missing Input Files!");
        if (!inputs.outputPath) return alert("Missing Output Path!");

        setLogs(["--- STARTING PROCESS ---"]);
        
        // PHASE 1: ANALYZE
        setStatus('analyzing');
        setProgress(0);
        let analysisResult = null;

        if (window.electronAPI) {
            const res = await window.electronAPI.analyzeSync(inputs);
            if (res.success) {
                analysisResult = res.data;
                setLogs(prev => ["Analysis Done. Starting Render...", ...prev]);
            } else {
                setLogs(prev => [`Analysis Failed: ${res.message}`, ...prev]);
                setStatus('idle');
                return;
            }
        }

        // PHASE 2: RENDER IMMEDIATELY
        setStatus('rendering');
        setProgress(0);

        if (window.electronAPI && analysisResult) {
            const res = await window.electronAPI.renderSync({ inputs, config, analysisData: analysisResult });
            if (res.success) {
                alert(res.message);
                setLogs(prev => ["PROCESS FINISHED SUCCESSFULLY!", ...prev]);
            } else {
                setLogs(prev => [`Render Failed: ${res.message}`, ...prev]);
            }
        }
        setStatus('idle');
    };

    // UI RENDER
    return (
        <div className="max-w-5xl mx-auto h-full flex flex-col pb-4">
            <div className="flex gap-6 h-full">
                {/* LEFT COLUMN: INPUTS */}
                <div className="w-1/2 flex flex-col gap-4 overflow-y-auto custom-scrollbar pr-2">
                    <div className="bg-[#1e222b] p-5 rounded border border-gray-700 shadow-lg">
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2"><FileVideo className="text-orange-500" size={20} /><h3 className="font-bold text-gray-200">Source Files</h3></div>
                        <PathInput label="Original Video" placeholder="Select video..." value={inputs.videoPath} onChange={(v) => handleSetInput('videoPath', v)} isFile={true} filters={[{ name: 'Video', extensions: ['mp4', 'mov', 'mkv', 'avi'] }]} />
                        <PathInput label="Voiceover Audio" placeholder="Select audio..." value={inputs.audioPath} onChange={(v) => handleSetInput('audioPath', v)} isFile={true} filters={[{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a'] }]} />
                        <PathInput label="Subtitle (SRT)" placeholder="Select .srt..." value={inputs.srtPath} onChange={(v) => handleSetInput('srtPath', v)} isFile={true} filters={[{ name: 'Subtitle', extensions: ['srt'] }]} />
                    </div>

                    <div className="bg-[#1e222b] p-5 rounded border border-gray-700 shadow-lg">
                         <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2"><Settings className="text-blue-500" size={20} /><h3 className="font-bold text-gray-200">Configuration</h3></div>
                        
                        {/* GPU SELECTION */}
                        <div className="mb-4">
                            <label className="block text-gray-500 text-xs font-bold mb-1 font-mono uppercase">Render Engine (Hardware Accel):</label>
                            <div className="relative">
                                <select 
                                    value={config.encoder || 'libx264'} 
                                    onChange={(e) => setConfig(p => ({...p, encoder: e.target.value}))}
                                    className="w-full bg-[#2a2e3b] border border-gray-600 text-white text-xs rounded px-3 py-2 font-bold appearance-none outline-none focus:border-orange-500"
                                >
                                    <option value="libx264">CPU (Slow - High Quality)</option>
                                    <option value="h264_nvenc">NVIDIA GPU (Fast - NVENC)</option>
                                    <option value="h264_amf">AMD GPU (Fast - AMF)</option>
                                    <option value="h264_qsv">INTEL GPU (Fast - QuickSync)</option>
                                </select>
                                <div className="absolute right-3 top-2.5 pointer-events-none text-gray-400"><Cpu size={14}/></div>
                            </div>
                            <p className="text-[9px] text-gray-500 mt-1">* Ensure your hardware supports the selected encoder.</p>
                        </div>

                        <div className="mb-6 flex items-center justify-between bg-[#15171e] p-3 rounded border border-gray-600">
                            <div><span className="text-sm font-bold text-gray-300 block">Sync Speed</span><span className="text-[10px] text-gray-500">Auto speed up/slow down video to match audio</span></div>
                            <div onClick={() => setConfig(p => ({...p, syncSpeed: !p.syncSpeed}))} className={`w-12 h-6 rounded-full p-1 cursor-pointer transition-colors ${config.syncSpeed ? 'bg-green-600' : 'bg-gray-600'}`}><div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${config.syncSpeed ? 'translate-x-6' : 'translate-x-0'}`}></div></div>
                        </div>

                        <div className="mb-4">
                            <div className="flex justify-between mb-2"><span className="text-xs font-bold text-gray-400 uppercase">Background Video Volume</span><span className="text-xs font-bold text-orange-500">{config.bgVolume}%</span></div>
                            <input type="range" min="0" max="100" value={config.bgVolume} onChange={(e) => setConfig(p => ({...p, bgVolume: parseInt(e.target.value)}))} className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer accent-orange-500" />
                        </div>
                    </div>
                </div>

                {/* RIGHT COLUMN: OUTPUT & PROCESS */}
                <div className="w-1/2 flex flex-col gap-4">
                    <div className="bg-[#1e222b] p-5 rounded border border-gray-700 shadow-lg flex-1 flex flex-col">
                        <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2"><Download className="text-green-500" size={20} /><h3 className="font-bold text-gray-200">Output & Process</h3></div>
                        <div className="mb-6">
                            <label className="block text-gray-500 text-xs font-bold mb-1 font-mono uppercase">Target Output File:</label>
                            <div className="flex gap-2">
                                <input type="text" value={inputs.outputPath} onChange={(e) => handleSetInput('outputPath', e.target.value)} className="flex-1 bg-[#2a2e3b] border border-gray-600 text-white text-xs rounded px-3 py-2" placeholder="e.g. D:\Result\FinalVideo.mp4"/>
                                <button onClick={handleSelectOutput} className="bg-orange-700 hover:bg-orange-600 text-white text-xs px-4 py-2 rounded font-bold">Browse</button>
                            </div>
                        </div>
                        
                        {/* PROGRESS BAR */}
                        {status !== 'idle' && (
                            <div className="mb-4">
                                <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                                    <span className="uppercase font-bold text-blue-400">{status === 'analyzing' ? 'Analyzing...' : 'Rendering...'}</span>
                                    <span>{progress}%</span>
                                </div>
                                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-300 ${status === 'analyzing' ? 'bg-blue-500' : 'bg-green-500'}`} style={{ width: `${progress}%` }}></div>
                                </div>
                            </div>
                        )}

                        <div className="bg-[#15171e] flex-1 rounded border border-gray-700 mb-4 p-2 font-mono text-xs text-gray-400 relative">
                            <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2">
                                {logs.length === 0 ? <div className="h-full flex items-center justify-center text-gray-600 italic">Ready to start...</div> : logs.map((l, i) => <div key={i} className="mb-1">{l}</div>)}
                            </div>
                        </div>

                        {status !== 'idle' ? (
                            <button onClick={handleStop} className="w-full bg-red-600 hover:bg-red-700 text-white py-4 rounded font-bold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 animate-pulse">
                                <Ban size={20} /> STOP PROCESS
                            </button>
                        ) : (
                            <button onClick={handleStartProcess} className="w-full bg-blue-600 hover:bg-blue-700 text-white py-4 rounded font-bold text-sm uppercase tracking-wider shadow-lg flex items-center justify-center gap-2 transition-all">
                                <Zap size={20} /> Start Process (Analyze & Render)
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

const TTSTab = () => {
    // 1. Khởi tạo State cấu hình TTS
    const [config, setConfig] = useState(() => {
        try {
            const saved = localStorage.getItem('tts_config');
            return saved ? JSON.parse(saved) : {
                apiUrl: 'http://127.0.0.1:9880',
                refAudio: '', refText: '', refLang: 'vi', targetLang: 'vi',
                inputPath: '', outputFolder: '', format: 'wav', outputFilename: ''
            };
        } catch { return { apiUrl: 'http://127.0.0.1:9880', refAudio: '', refText: '', refLang: 'vi', targetLang: 'vi', inputPath: '', outputFolder: '', format: 'wav', outputFilename: '' }; }
    });

    // 2. Khởi tạo State cấu hình Server
    const [serverConfig, setServerConfig] = useState({
        pythonPath: localStorage.getItem('tts_py_path') || '',
        apiScriptPath: localStorage.getItem('tts_script_path') || ''
    });

    const [logs, setLogs] = useState([]);
    const [isRunning, setIsRunning] = useState(false);
    const [isConnected, setIsConnected] = useState(false);
    const [isServerRunning, setIsServerRunning] = useState(false);
    const [progress, setProgress] = useState(0);
    const isStopping = useRef(false);

    // Lưu config mỗi khi thay đổi
    useEffect(() => { localStorage.setItem('tts_config', JSON.stringify(config)); }, [config]);

    // Lắng nghe Log và Progress từ Electron
    useEffect(() => {
        let cleanLog, cleanProgress;
        if(window.electronAPI) {
            cleanLog = window.electronAPI.onSystemLog(msg => setLogs(p => [msg, ...p]));
            if(window.electronAPI.onTTSProgress) {
                cleanProgress = window.electronAPI.onTTSProgress(p => setProgress(p));
            }
        }
        return () => { if(cleanLog) cleanLog(); if(cleanProgress) cleanProgress(); };
    }, []);

    // Tự động kiểm tra kết nối khi mở tab
    useEffect(() => {
        checkConnection();
    }, []);

    // --- CÁC HÀM XỬ LÝ ---

    const checkConnection = async () => {
        if(window.electronAPI) {
            const ok = await window.electronAPI.checkTTSConnection(config.apiUrl);
            setIsConnected(ok);
            setLogs(p => [ok ? "Ready: Đã kết nối tới GPT-SoVITS Server." : "Error: Không thể kết nối tới Server.", ...p]);
        }
    };

    const handleStartServer = async () => {
        if (!serverConfig.pythonPath || !serverConfig.apiScriptPath) return alert("Chọn Python EXE và api_v2.py!");
        setIsServerRunning(true);
        setLogs(p => [">>> Đang khởi động API Server ngầm...", ...p]);
        await window.electronAPI.startServer(serverConfig);
        setTimeout(checkConnection, 5000); // Tự động check sau 5s
    };

    const handleStopServer = async () => {
        if(window.electronAPI && window.electronAPI.stopServer) {
            setLogs(p => [">>> Đang dừng API Server...", ...p]);
            await window.electronAPI.stopServer();
            setIsServerRunning(false);
            setIsConnected(false);
            setLogs(p => [">>> Server đã dừng.", ...p]);
        }
    };

    const handleStart = async () => {
        if (!isConnected) return alert("Vui lòng kết nối API Server trước!");
        if (!config.refAudio) return alert("Chưa chọn File Giọng Mẫu!");
        if (!config.refText || !config.refText.trim()) return alert("Chưa nhập Nội dung giọng mẫu!");
        if (!config.inputPath) return alert("Chưa chọn File Nội dung cần đọc!");
        if (!config.outputFolder) return alert("Chưa chọn Thư mục lưu kết quả!");

        isStopping.current = false;
        setIsRunning(true); setProgress(0);
        setLogs(p => [">>> Bắt đầu gửi yêu cầu TTS...", ...p]);
        const res = await window.electronAPI.startTTS(config);
        
        if (!isStopping.current && res.success) alert(res.message);
        setIsRunning(false);
    };

    const handleStop = async () => {
        isStopping.current = true;
        setLogs(p => [">>> Đang dừng GSpeech...", ...p]);
        if(window.electronAPI && window.electronAPI.stopJPVoiceTTS) await window.electronAPI.stopJPVoiceTTS();
        setIsRunning(false);
    };

    return (
        <div className="max-w-5xl mx-auto flex gap-6 h-full pb-4">
            {/* CỘT TRÁI: CẤU HÌNH TEXT TO SPEECH */}
            <div className="w-1/2 flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar pr-1">
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700 shadow-md">
                    <h3 className="text-orange-500 font-bold text-sm mb-4 uppercase">GSPEECH SETTINGS</h3>
                    
                    <PathInput label="File Giọng Mẫu (WAV)" value={config.refAudio} onChange={v => setConfig({...config, refAudio: v})} isFile={true} filters={[{name: 'Audio', extensions:['wav']}]} />
                    
                    <div className="mb-3">
                        <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Nội dung giọng mẫu (Prompt Text):</label>
                        <textarea value={config.refText} onChange={e => setConfig({...config, refText: e.target.value.replace(/[\r\n]+/g, ' ')})} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 h-16 outline-none focus:border-orange-500 resize-none" />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Ngôn ngữ mẫu:</label>
                            <select value={config.refLang} onChange={e => setConfig({...config, refLang: e.target.value})} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none cursor-pointer">
                                <option value="vi">Tiếng Việt</option>
                                <option value="en">Tiếng Anh</option>
                                <option value="zh">Tiếng Trung</option>
                                <option value="ja">Tiếng Nhật</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Ngôn ngữ cần đọc:</label>
                            <select value={config.targetLang} onChange={e => setConfig({...config, targetLang: e.target.value})} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none cursor-pointer">
                                <option value="vi">Tiếng Việt</option>
                                <option value="en">Tiếng Anh</option>
                                <option value="zh">Tiếng Trung</option>
                                <option value="ja">Tiếng Nhật</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="bg-[#1e222b] p-4 rounded border border-gray-700 shadow-md">
                    <h3 className="text-blue-400 font-bold text-sm mb-4 uppercase flex items-center gap-2"><Folder size={16}/> File & Output</h3>
                    <PathInput label="Nội dung (.txt hoặc .srt)" value={config.inputPath} onChange={v => setConfig({...config, inputPath: v})} isFile={true} filters={[{name: 'Text/Sub', extensions:['txt', 'srt']}]} />
                    <PathInput label="Thư mục lưu kết quả" value={config.outputFolder} onChange={v => setConfig({...config, outputFolder: v})} />
                    
                    <div className="mt-3">
                        <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Tên file xuất (Tùy chọn):</label>
                        <div className="flex gap-2 items-center">
                            <input type="text" value={config.outputFilename || ''} onChange={e => setConfig({...config, outputFilename: e.target.value})} className="flex-1 bg-[#15171e] border border-gray-600 text-white text-xs rounded px-3 py-2 outline-none focus:border-orange-500" placeholder="Mặc định: Tên_Input_tts" />
                            <div className="bg-[#2a2e3b] border border-gray-600 text-gray-400 text-xs rounded px-3 py-2 font-bold">.{config.format}</div>
                        </div>
                    </div>

                    <div className="mt-3">
                        <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Định dạng xuất:</label>
                        <select value={config.format} onChange={e => setConfig({...config, format: e.target.value})} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none">
                            <option value="wav">WAV (Chất lượng gốc)</option>
                            <option value="mp3">MP3 (Nén nhẹ)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* CỘT PHẢI: API SERVER & LOG TIẾN TRÌNH */}
            <div className="w-1/2 flex flex-col gap-4 h-full">
                {/* Cụm API SERVER (Phía trên bên phải) */}
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700 shadow-lg">
                    <h3 className="text-green-500 font-bold text-sm mb-4 uppercase flex justify-between items-center">
                        <div className="flex items-center gap-2"><Cpu size={16}/> API Server</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${isConnected ? 'bg-green-600/20 text-green-500' : 'bg-red-600/20 text-red-500'}`}>
                            {isConnected ? '● ONLINE' : '● OFFLINE'}
                        </span>
                    </h3>
                    <div className="space-y-3">
                        <PathInput label="Python EXE (Runtime)" value={serverConfig.pythonPath} onChange={v => {setServerConfig({...serverConfig, pythonPath: v}); localStorage.setItem('tts_py_path', v)}} isFile={true} />
                        <PathInput label="File api_v2.py" value={serverConfig.apiScriptPath} onChange={v => {setServerConfig({...serverConfig, apiScriptPath: v}); localStorage.setItem('tts_script_path', v)}} isFile={true} />
                        <button onClick={isServerRunning ? handleStopServer : handleStartServer} className={`w-full py-2.5 rounded font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md ${isServerRunning ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'}`}>
                            {isServerRunning ? <Ban size={14}/> : <Play size={14}/>}
                            {isServerRunning ? "STOP SERVER (GPU)" : "START SERVER (GPU)"}
                        </button>
                    </div>
                </div>

                {/* Log hệ thống & Progress (Phía dưới bên phải) */}
                <div className="bg-[#1e222b] p-5 rounded border border-gray-700 shadow-lg flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2">
                        <Mic className="text-orange-500" size={20} />
                        <h3 className="font-bold text-gray-200 uppercase text-sm tracking-wider">Log hệ thống</h3>
                    </div>

                    {/* PROGRESS BAR */}
                    {isRunning && (
                        <div className="mb-4">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">
                                <span className="uppercase text-blue-400">Đang xử lý TTS...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden border border-gray-600">
                                <div className="bg-blue-500 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}

                    {/* Ô LOG (Làm ngắn lại nhờ flex-1) */}
                    <div className="bg-[#15171e] flex-1 rounded border border-gray-700 p-2 font-mono text-[10px] text-gray-400 relative overflow-hidden">
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2">
                            {logs.length === 0 ? <div className="h-full flex items-center justify-center text-gray-600 italic">Sẵn sàng xử lý dữ liệu...</div> : logs.map((l, i) => <div key={i} className="mb-1 border-b border-gray-800/50 pb-1">{l}</div>)}
                        </div>
                    </div>

                    <button 
                        onClick={isRunning ? handleStop : handleStart} 
                        disabled={!isConnected && !isRunning}
                        className={`w-full mt-4 py-4 rounded font-bold text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all ${(!isConnected && !isRunning) ? 'bg-gray-700 text-gray-500' : (isRunning ? 'bg-red-600 hover:bg-red-700' : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800')} text-white`}
                    >
                        {isRunning ? <Ban size={20} /> : <Zap size={20} />}
                        {isRunning ? "STOP GSPEECH" : "START GSPEECH"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- JP VOICE TAB (NEW) ---
const JPVoiceTab = () => {
    // 1. Config State
    const [config, setConfig] = useState(() => {
        try {
            const saved = localStorage.getItem('jp_voice_config');
            const defaultConfig = {
                enginePath: '',
                speakerId: '1', // Default to a common ID
                styleId: '1', // This will be the actual ID sent to the API
                inputPath: '',
                outputFolder: '',
                format: 'wav',
                outputFilename: '',
                speed: 1.0,
                pitch: 0.0
            };
            return saved ? { ...defaultConfig, ...JSON.parse(saved) } : defaultConfig;
        } catch {
            return {
                enginePath: '', speakerId: '1', styleId: '1',
                inputPath: '', outputFolder: '', format: 'wav',
                outputFilename: '',
                speed: 1.0,
                pitch: 0.0
            };
        }
    });

    const [speakers, setSpeakers] = useState([]);
    const [selectedCharacter, setSelectedCharacter] = useState(null);
    const [styles, setStyles] = useState([]);

    const [isEngineRunning, setIsEngineRunning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [logs, setLogs] = useState([]);
    const [progress, setProgress] = useState(0);

    // 2. Save & Effects
    useEffect(() => {
        localStorage.setItem('jp_voice_config', JSON.stringify(config));
    }, [config]);

    useEffect(() => {
        let cleanStatus, cleanProgress, cleanLog;
        if (window.electronAPI) {
            cleanLog = window.electronAPI.onSystemLog(msg => setLogs(p => [msg, ...p]));
            cleanStatus = window.electronAPI.onJPVoiceStatus(({ isRunning }) => setIsEngineRunning(isRunning));
            cleanProgress = window.electronAPI.onJPVoiceProgress(p => setProgress(p));
        }
        return () => {
            if(cleanLog) cleanLog();
            if (cleanStatus) cleanStatus();
            if (cleanProgress) cleanProgress();
        };
    }, []);

    // 3. Handlers
    const handleStartEngine = async () => {
        if (!config.enginePath) return alert("Please select the VOICEVOX run.exe path.");
        setLogs(p => [">>> Starting VOICEVOX Engine...", ...p]);
        await window.electronAPI.startJPVoiceEngine(config.enginePath);
        // After starting, try to fetch speakers
        setTimeout(fetchSpeakers, 5000);
    };

    const handleStopEngine = async () => {
        setLogs(p => [">>> Stopping VOICEVOX Engine...", ...p]);
        await window.electronAPI.stopJPVoiceEngine();
    };

    const fetchSpeakers = async () => {
        setLogs(p => [">>> Fetching speakers from engine...", ...p]);
        const res = await window.electronAPI.getJPVoiceSpeakers();
        if (res.success) {
            setSpeakers(res.data);
            setLogs(p => [ `>>> Found ${res.data.length} characters.`, ...p]);
            // Set a default character if none is selected
            if (!selectedCharacter && res.data.length > 0) {
                handleCharacterChange(res.data[0].name, res.data);
            }
        } else {
            setLogs(p => [`[ERROR] Could not fetch speakers: ${res.message}`, ...p]);
        }
    };
    
    const handleCharacterChange = (characterName, speakerList = speakers) => {
        const character = speakerList.find(s => s.name === characterName);
        if (character) {
            setSelectedCharacter(character);
            setStyles(character.styles);
            // Set default style and update the main config styleId
            setConfig(c => ({ ...c, speakerId: character.name, styleId: character.styles[0].id }));
        }
    };

    const handleStart = async () => {
        if (!isEngineRunning) return alert("Please start the VOICEVOX Engine first!");
        if (!config.inputPath || !config.outputFolder) return alert("Please select an input file and output folder.");

        setIsProcessing(true);
        setProgress(0);
        setLogs(p => [">>> Starting JP Voice TTS...", ...p]);
        
        const ttsConfig = {
            ...config,
            // The API uses the style ID as the 'speaker' parameter
            speakerId: config.styleId 
        };

        const res = await window.electronAPI.runJPVoiceTTS(ttsConfig);
        if (res.success) alert(res.message || "Process completed!");
        
        setIsProcessing(false);
    };

    const handleStop = async () => {
        if (window.electronAPI.stopJPVoiceTTS) {
            await window.electronAPI.stopJPVoiceTTS();
        }
        setIsProcessing(false);
    };

    // 4. UI Render
    return (
        <div className="max-w-5xl mx-auto flex gap-6 h-full pb-4">
            {/* LEFT COLUMN */}
            <div className="w-1/2 flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar pr-1">
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700 shadow-md">
                    <h3 className="text-orange-500 font-bold text-sm mb-4 uppercase flex justify-between items-center">
                        JP Voice Settings
                        <span className={`text-[10px] px-2 py-0.5 rounded ${isEngineRunning ? 'bg-green-600/20 text-green-500' : 'bg-red-600/20 text-red-500'}`}>
                            {isEngineRunning ? '● ENGINE RUNNING' : '● ENGINE OFFLINE'}
                        </span>
                    </h3>
                    
                    <PathInput label="VOICEVOX Engine (run.exe)" value={config.enginePath} onChange={v => setConfig({...config, enginePath: v})} isFile={true} filters={[{name: 'Executable', extensions:['exe']}]} />
                    
                    <div className="flex gap-2 mb-3">
                        <button onClick={handleStartEngine} disabled={isEngineRunning} className="flex-1 py-2 rounded font-bold text-xs bg-green-700 hover:bg-green-600 disabled:bg-gray-600 disabled:opacity-50">START ENGINE</button>
                        <button onClick={handleStopEngine} disabled={!isEngineRunning} className="flex-1 py-2 rounded font-bold text-xs bg-red-700 hover:bg-red-600 disabled:bg-gray-600 disabled:opacity-50">STOP ENGINE</button>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Model/Character:</label>
                            <div className="relative">
                                <select value={config.speakerId} onChange={e => handleCharacterChange(e.target.value)} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none cursor-pointer appearance-none">
                                    {speakers.length === 0 && <option>Click "Fetch" after starting engine</option>}
                                    {speakers.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                </select>
                                <button onClick={fetchSpeakers} className="absolute right-1 top-1 bg-orange-600 hover:bg-orange-700 text-white px-2 py-1 rounded text-[9px] font-bold">Fetch</button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Style:</label>
                            <select value={config.styleId} onChange={e => setConfig({...config, styleId: e.target.value})} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none cursor-pointer">
                                {styles.map(st => <option key={st.id} value={st.id}>{st.name} (ID: {st.id})</option>)}
                            </select>
                        </div>
                    </div>

                    {/* Speed & Pitch Inputs */}
                    <div className="mt-4 border-t border-gray-600 pt-4 grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-gray-500 text-[10px] font-bold uppercase font-mono mb-1">Speed</label>
                            <input
                                type="number" min="0.5" max="2.0" step="0.05"
                                value={config.speed}
                                onChange={e => setConfig({ ...config, speed: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none focus:border-orange-500 font-bold text-center"
                            />
                        </div>
                        <div>
                            <label className="block text-gray-500 text-[10px] font-bold uppercase font-mono mb-1">Pitch</label>
                            <input
                                type="number" min="-0.15" max="0.15" step="0.01"
                                value={config.pitch}
                                onChange={e => setConfig({ ...config, pitch: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                                className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none focus:border-orange-500 font-bold text-center"
                            />
                        </div>
                    </div>
                </div>

                <div className="bg-[#1e222b] p-4 rounded border border-gray-700 shadow-md">
                    <h3 className="text-blue-400 font-bold text-sm mb-4 uppercase flex items-center gap-2"><Folder size={16}/> File & Output</h3>
                    <PathInput label="Nội dung (.txt hoặc .srt)" value={config.inputPath} onChange={v => setConfig({...config, inputPath: v})} isFile={true} filters={[{name: 'Text/Sub', extensions:['txt', 'srt']}]} />
                    <PathInput label="Thư mục lưu kết quả" value={config.outputFolder} onChange={v => setConfig({...config, outputFolder: v})} />
                    
                    <div className="mt-3">
                        <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Tên file xuất (Tùy chọn):</label>
                        <div className="flex gap-2 items-center">
                            <input type="text" value={config.outputFilename || ''} onChange={e => setConfig({...config, outputFilename: e.target.value})} className="flex-1 bg-[#15171e] border border-gray-600 text-white text-xs rounded px-3 py-2 outline-none focus:border-orange-500" placeholder="Mặc định: Tên_Input_tts" />
                            <div className="bg-[#2a2e3b] border border-gray-600 text-gray-400 text-xs rounded px-3 py-2 font-bold">.{config.format}</div>
                        </div>
                    </div>

                    <div className="mt-3">
                        <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Định dạng xuất:</label>
                        <select value={config.format} onChange={e => setConfig({...config, format: e.target.value})} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none">
                            <option value="wav">WAV (Chất lượng gốc)</option>
                            <option value="mp3">MP3 (Nén nhẹ)</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* RIGHT COLUMN */}
            <div className="w-1/2 flex flex-col gap-4 h-full">
                <div className="bg-[#1e222b] p-5 rounded border border-gray-700 shadow-lg flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2">
                        <Mic className="text-orange-500" size={20} />
                        <h3 className="font-bold text-gray-200 uppercase text-sm tracking-wider">Log hệ thống</h3>
                    </div>

                    {isProcessing && (
                        <div className="mb-4">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">
                                <span className="uppercase text-blue-400">Đang xử lý TTS...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden border border-gray-600">
                                <div className="bg-blue-500 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}

                    <div className="bg-[#15171e] flex-1 rounded border border-gray-700 p-2 font-mono text-[10px] text-gray-400 relative overflow-hidden">
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2">
                            {logs.length === 0 ? <div className="h-full flex items-center justify-center text-gray-600 italic">Sẵn sàng...</div> : logs.map((l, i) => <div key={i} className="mb-1 border-b border-gray-800/50 pb-1">{l}</div>)}
                        </div>
                    </div>

                    {isProcessing ? (
                        <button onClick={handleStop} className="w-full mt-4 py-4 rounded font-bold text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all bg-red-600 hover:bg-red-700 text-white">
                            <Ban size={20} /> STOP
                        </button>
                    ) : (
                        <button 
                            onClick={handleStart} 
                            disabled={!isEngineRunning}
                            className={`w-full mt-4 py-4 rounded font-bold text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all ${(!isEngineRunning) ? 'bg-gray-700 text-gray-500' : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white'}`}
                        >
                            <Zap size={20} /> START
                        </button>
                    )}

                </div>
            </div>
        </div>
    );
};

// --- FSPEECH TAB (FISH SPEECH) ---
const FSpeechTab = () => {
    // Server and Model Config
    const [serverConfig, setServerConfig] = useState(() => {
        const defaults = {
            pythonPath: '',
            rootPath: '',
            llamaPath: 'checkpoints/fish-speech-1.5',
            decoderPath: 'checkpoints/fish-speech-1.5/firefly-gan-vq-fsq-8x1024-21hz-generator.pth'
        };
        try {
            const saved = localStorage.getItem('fs_server_config');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch { return defaults; }
    });

    // TTS Settings
    const [config, setConfig] = useState(() => {
        const defaults = {
            refAudio: '',
            refText: '',
            inputPath: '',
            outputFolder: '',
            outputFilename: '',
            format: 'wav'
        };
        try {
            const saved = localStorage.getItem('fs_config');
            return saved ? { ...defaults, ...JSON.parse(saved) } : defaults;
        } catch { return defaults; }
    });

    const [logs, setLogs] = useState([]);
    const [isServerRunning, setIsServerRunning] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [progress, setProgress] = useState(0);
    const isStopping = useRef(false);

    // Save configs on change
    useEffect(() => { localStorage.setItem('fs_server_config', JSON.stringify(serverConfig)); }, [serverConfig]);
    useEffect(() => { localStorage.setItem('fs_config', JSON.stringify(config)); }, [config]);

    useEffect(() => {
        let cleanLog, cleanProgress;
        if (window.electronAPI) {
            cleanLog = window.electronAPI.onSystemLog(msg => setLogs(p => [msg, ...p]));
            if (window.electronAPI.onTTSProgress) {
                cleanProgress = window.electronAPI.onTTSProgress(p => setProgress(p));
            }
        }
        return () => { if (cleanLog) cleanLog(); if (cleanProgress) cleanProgress(); };
    }, []);

    const handleStartServer = async () => {
        if (!serverConfig.pythonPath || !serverConfig.rootPath) return alert("Please select Python Runtime and FSpeech Root Folder!");
        setIsServerRunning(true);
        setLogs(p => [">>> Starting FSpeech API Server...", ...p]);
        if (window.electronAPI) await window.electronAPI.startFishServer(serverConfig);
    };

    const handleStopServer = async () => {
        if (window.electronAPI) {
            setLogs(p => [">>> Stopping FSpeech API Server...", ...p]);
            await window.electronAPI.stopFishServer();
            setIsServerRunning(false);
        }
    };

    const handleStartFSpeech = async () => {
        if (!isServerRunning) return alert("Please START SERVER first!");
        if (!config.refAudio || !config.refText || !config.inputPath || !config.outputFolder) {
            return alert("Please fill all required fields: Reference Audio, Reference Text, Input Content, and Output Folder.");
        }
        
        isStopping.current = false;
        setIsProcessing(true);
        setProgress(0);
        setLogs(p => [">>> Starting FSpeech process...", ...p]);

        if (window.electronAPI) {
            const res = await window.electronAPI.generateFishSpeech(config);
            if (!isStopping.current && res.success) {
                alert(res.message);
            }
        }
        setIsProcessing(false);
    };

    const handleStopFSpeech = async () => {
        isStopping.current = true;
        setLogs(p => [">>> Stopping FSpeech...", ...p]);
        if (window.electronAPI && window.electronAPI.stopFishSpeech) {
            await window.electronAPI.stopFishSpeech();
        }
        setIsProcessing(false);
    };

    return (
        <div className="max-w-5xl mx-auto flex gap-6 h-full pb-4">
            {/* LEFT COLUMN */}
            <div className="w-1/2 flex flex-col gap-3 h-full overflow-y-auto custom-scrollbar pr-1">
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700 shadow-md">
                    <h3 className="text-orange-500 font-bold text-sm mb-4 uppercase">FSPEECH SETTINGS</h3>
                    <PathInput label="Llama Model Path" value={serverConfig.llamaPath} onChange={v => setServerConfig({...serverConfig, llamaPath: v})} />
                    <PathInput label="Decoder Path (.pth)" value={serverConfig.decoderPath} onChange={v => setServerConfig({...serverConfig, decoderPath: v})} isFile={true} filters={[{name: 'PyTorch Model', extensions:['pth']}]} />
                    <PathInput label="Reference Audio (.wav/mp3)" value={config.refAudio} onChange={v => setConfig({...config, refAudio: v})} isFile={true} filters={[{name: 'Audio', extensions:['wav', 'mp3']}]} />
                    <div className="mb-3"><label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Reference Text (Subtitle):</label><textarea value={config.refText} onChange={e => setConfig({...config, refText: e.target.value})} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 h-16 outline-none focus:border-blue-500 resize-none" placeholder="Enter the text content of the reference audio..." /></div>
                </div>
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700 shadow-md">
                    <h3 className="text-blue-400 font-bold text-sm mb-4 uppercase flex items-center gap-2"><Folder size={16}/> File & Output</h3>
                    <PathInput label="Input Content (.txt or .srt)" value={config.inputPath} onChange={v => setConfig({...config, inputPath: v})} isFile={true} filters={[{name: 'Text/Sub', extensions:['txt', 'srt']}]} />
                    <PathInput label="Output Folder" value={config.outputFolder} onChange={v => setConfig({...config, outputFolder: v})} />
                    <div className="mt-3">
                        <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Output Filename (Optional):</label>
                        <div className="flex gap-2 items-center">
                            <input type="text" value={config.outputFilename || ''} onChange={e => setConfig({...config, outputFilename: e.target.value})} className="flex-1 bg-[#15171e] border border-gray-600 text-white text-xs rounded px-3 py-2 outline-none focus:border-orange-500" placeholder="Default: [Input_Name]_fspeech" />
                            <div className="bg-[#2a2e3b] border border-gray-600 text-gray-400 text-xs rounded px-3 py-2 font-bold">.{config.format}</div>
                        </div>
                    </div>
                    <div className="mt-3">
                        <label className="block text-gray-500 text-[10px] font-bold mb-1 uppercase font-mono">Output Format:</label>
                        <select value={config.format} onChange={e => setConfig({...config, format: e.target.value})} className="w-full bg-[#15171e] border border-gray-600 text-white text-xs rounded p-2 outline-none">
                            <option value="wav">WAV (Original Quality)</option>
                            <option value="mp3">MP3 (Compressed)</option>
                        </select>
                    </div>
                </div>
            </div>
            {/* RIGHT COLUMN */}
            <div className="w-1/2 flex flex-col gap-4 h-full">
                <div className="bg-[#1e222b] p-4 rounded border border-gray-700 shadow-lg">
                    <h3 className="text-green-500 font-bold text-sm mb-4 uppercase flex justify-between items-center">
                        <div className="flex items-center gap-2"><Cpu size={16}/> API SERVER & MODEL CONFIG</div>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${isServerRunning ? 'bg-green-600/20 text-green-500' : 'bg-red-600/20 text-red-500'}`}>{isServerRunning ? '● RUNNING' : '● OFFLINE'}</span>
                    </h3>
                    <div className="space-y-3">
                        <PathInput label="Python Runtime (python.exe)" value={serverConfig.pythonPath} onChange={v => setServerConfig({...serverConfig, pythonPath: v})} isFile={true} filters={[{name: 'Executable', extensions:['exe']}]} />
                        <PathInput label="FSpeech Root Folder" value={serverConfig.rootPath} onChange={v => setServerConfig({...serverConfig, rootPath: v})} />
                        <button onClick={isServerRunning ? handleStopServer : handleStartServer} className={`w-full py-2.5 rounded font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-md ${isServerRunning ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-green-700 hover:bg-green-600 text-white'}`}>
                            {isServerRunning ? <Ban size={14}/> : <Play size={14}/>}
                            {isServerRunning ? "STOP SERVER (GPU)" : "START SERVER (GPU)"}
                        </button>
                    </div>
                </div>
                <div className="bg-[#1e222b] p-5 rounded border border-gray-700 shadow-lg flex-1 flex flex-col overflow-hidden">
                    <div className="flex items-center gap-2 mb-4 border-b border-gray-700 pb-2">
                        <Mic className="text-orange-500" size={20} />
                        <h3 className="font-bold text-gray-200 uppercase text-sm tracking-wider">System Logs</h3>
                    </div>
                    {isProcessing && (
                        <div className="mb-4">
                            <div className="flex justify-between text-[10px] text-gray-400 mb-1 font-bold">
                                <span className="uppercase text-blue-400">Processing FSpeech...</span>
                                <span>{progress}%</span>
                            </div>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden border border-gray-600">
                                <div className="bg-blue-500 h-full transition-all duration-300 shadow-[0_0_10px_rgba(59,130,246,0.6)]" style={{ width: `${progress}%` }}></div>
                            </div>
                        </div>
                    )}
                    <div className="bg-[#15171e] flex-1 rounded border border-gray-700 p-2 font-mono text-[10px] text-gray-400 relative overflow-hidden">
                        <div className="absolute inset-0 overflow-y-auto custom-scrollbar p-2">
                            {logs.length === 0 ? <div className="h-full flex items-center justify-center text-gray-600 italic">Ready...</div> : logs.map((l, i) => <div key={i} className="mb-1 border-b border-gray-800/50 pb-1">{l}</div>)}
                        </div>
                    </div>
                    <button 
                        onClick={isProcessing ? handleStopFSpeech : handleStartFSpeech} 
                        disabled={!isServerRunning && !isProcessing}
                        className={`w-full mt-4 py-4 rounded font-bold text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all ${(!isServerRunning && !isProcessing) ? 'bg-gray-700 text-gray-500' : (isProcessing ? 'bg-red-600 hover:bg-red-700' : 'bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800')} text-white`}
                    >
                        {isProcessing ? <Ban size={20} /> : <Zap size={20} />}
                        {isProcessing ? "STOP FSPEECH" : "START FSPEECH"}
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- SETTINGS TAB (UPDATED V1.0.0) ---
const SettingsTab = () => {
    return (
        <div className="max-w-3xl mx-auto text-white">
            <div className="bg-[#1e222b] p-6 rounded border border-gray-700 shadow-lg">
                {/* Header */}
                <div className="flex items-center gap-3 mb-6 border-b border-gray-700 pb-4">
                    <div className="bg-orange-500/20 p-3 rounded-full">
                        <Settings size={24} className="text-orange-500" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold">System Settings</h2>
                        <p className="text-xs text-gray-400">Manage tool configurations and license.</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {/* License Info Section (Hidden HWID) */}
                    <div className="bg-[#15171e] p-4 rounded border border-gray-600 flex justify-between items-center">
                        <h3 className="text-sm font-bold text-gray-300 uppercase flex items-center gap-2">
                            <Key size={14}/> License Information
                        </h3>
                        <span className="text-[10px] text-green-500 font-bold border border-green-500 px-2 py-0.5 rounded uppercase">
                            Activated
                        </span>
                    </div>

                    {/* App Info Section (Updated Version) */}
                    <div className="bg-[#15171e] p-4 rounded border border-gray-600">
                         <h3 className="text-sm font-bold text-gray-300 mb-2 uppercase flex items-center gap-2">
                            <Cpu size={14}/> Application Info
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="text-[10px] text-gray-500 block uppercase font-bold">Version:</span>
                                <span className="text-sm font-bold">v1.0.4</span>
                            </div>
                            <div>
                                <span className="text-[10px] text-gray-500 block uppercase font-bold">Engine Status:</span>
                                <span className="text-sm font-bold text-blue-400">Ready</span>
                            </div>
                        </div>
                    </div>
                    
                    {/* Actions Section */}
                    <div className="flex gap-3 mt-6">
                        <button 
                            onClick={() => window.location.reload()}
                            className="flex items-center justify-center gap-2 bg-[#2a2e3b] hover:bg-[#363b4b] text-gray-300 py-2 px-4 rounded text-xs font-bold border border-gray-600 transition-all"
                        >
                            <RefreshCw size={14} /> Reload Interface
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MAIN APP ---
export default function App() {
  const [activeTab, setActiveTab] = useState('rename');
  const [isActivated, setIsActivated] = useState(false); 
  const [upStatus, setUpStatus] = useState('idle'); 
  const [upMsg, setUpMsg] = useState(''); 
  
  // Xóa state isUpdating vì ta sẽ dùng upStatus để kiểm soát
  // const [isUpdating, setIsUpdating] = useState(false); 

  useEffect(() => { 
      if(window.electronAPI) { 
          window.electronAPI.checkLicense().then(res => { if(res.activated) setIsActivated(true); }); 
          window.electronAPI.updaterCheck(); 
          
          window.electronAPI.onUpdateStatus(({ status, msg }) => { 
              setUpStatus(status); 
              setUpMsg(msg);
              // BỎ ĐOẠN TỰ ĐỘNG CÀI ĐẶT Ở ĐÂY ĐỂ TRÁNH LỖI NGẦM
          }); 
      } 
  }, []);

  const handleUpdateConfirm = () => { 
      // 1. Chuyển trạng thái ngay lập tức để người dùng biết đang tải
      setUpStatus('downloading'); 
      setUpMsg('Starting download...');
      
      // 2. Gọi backend tải về
      if(window.electronAPI) window.electronAPI.updaterDownload(); 
  }; 

  const handleInstall = () => {
      // 3. Hàm mới để gọi lệnh cài đặt khi người dùng bấm
      if(window.electronAPI) window.electronAPI.updaterInstall();
  };

  const handleUpdateClose = () => { setUpStatus('idle'); };

  const menuItems = [ 
      { id: 'rename', label: 'Rename', icon: Edit3 }, 
      { id: 'dedup', label: 'Dedup', icon: Filter }, 
      { id: 'convert-9-16', label: 'Convert 9:16', icon: LayoutTemplate }, 
      { id: 'mix-video', label: 'Mix Video', icon: Video }, 
      { id: 'sync-video', label: 'Merge', icon: Zap },
      { id: 'tts', label: 'GSpeech', icon: Mic }, 
      { id: 'fspeech', label: 'FSpeech', icon: Mic },
      { id: 'jp-voice', label: 'JP Voice', icon: Mic }, 
      { id: 'settings', label: 'Settings', icon: Settings } 
  ];

  const renderContent = () => { 
      switch (activeTab) { 
          case 'rename': return <RenameTab />; 
          case 'dedup': return <DedupTab />; 
          case 'convert-9-16': return <Convert9to16Tab />; 
          case 'mix-video': return <MixVideoTab />; 
          case 'sync-video': return <SyncVideoTab />;
          case 'tts': return <TTSTab />; 
          case 'fspeech': return <FSpeechTab />;
          case 'jp-voice': return <JPVoiceTab />; 
          case 'settings': return <SettingsTab />; 
          default: return null; 
      } 
  };
  
  if (!isActivated) return <ActivationScreen onActivated={() => setIsActivated(true)} />;
  
  return (
    <div className="flex h-screen w-full bg-[#11141c] text-white font-sans overflow-hidden select-none relative">
      {/* UPDATE MODAL CUSTOMIZED */}
      {['available', 'downloading', 'downloaded', 'error'].includes(upStatus) && (
        <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"> 
            <div className="bg-[#1e222b] border border-gray-600 rounded-lg shadow-2xl w-full max-w-md p-6 flex flex-col gap-4"> 
                <div className="flex items-center gap-3 border-b border-gray-700 pb-4"> 
                    <div className="bg-green-500/20 p-2 rounded-full">
                        {upStatus === 'downloading' ? <Loader size={24} className="text-blue-500 animate-spin" /> : <Zap size={24} className="text-green-500" />}
                    </div> 
                    <div>
                        <h3 className="text-lg font-bold text-white">
                            {upStatus === 'downloaded' ? 'Ready to Install' : 'Update Manager'}
                        </h3>
                        <p className="text-xs text-gray-400">
                            {upStatus === 'downloading' ? 'Downloading updates...' : 'New version found.'}
                        </p>
                    </div> 
                </div> 
                <div className="bg-[#15171e] p-3 rounded border border-gray-700">
                    <p className="text-sm text-gray-300 font-mono text-center">{upMsg}</p>
                </div> 
                <div className="flex gap-3 justify-end pt-2"> 
                    {/* NÚT CLOSE (Chỉ hiện khi chưa tải xong) */}
                    {upStatus !== 'downloading' && (
                        <button onClick={handleUpdateClose} className="px-4 py-2 rounded text-sm font-bold text-gray-400 hover:bg-gray-700">Later</button>
                    )}
                    
                    {/* TRẠNG THÁI 1: CÓ BẢN MỚI -> NÚT UPDATE */}
                    {upStatus === 'available' && (
                        <button onClick={handleUpdateConfirm} className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded text-sm font-bold flex gap-2"> 
                            <Download size={16} /> Download 
                        </button>
                    )}

                    {/* TRẠNG THÁI 2: ĐANG TẢI -> NÚT DISABLE */}
                    {upStatus === 'downloading' && (
                        <button disabled className="w-full bg-blue-600/50 text-white px-6 py-2 rounded text-sm font-bold flex justify-center gap-2 cursor-wait"> 
                            <Loader size={16} className="animate-spin" /> Downloading... 
                        </button> 
                    )}

                    {/* TRẠNG THÁI 3: TẢI XONG -> NÚT INSTALL */}
                    {upStatus === 'downloaded' && (
                        <button onClick={handleInstall} className="w-full bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded text-sm font-bold flex justify-center gap-2 animate-pulse"> 
                            <RefreshCw size={16} /> Install & Restart 
                        </button> 
                    )}
                </div> 
            </div> 
        </div>
      )}

      <div className="w-56 flex-shrink-0 bg-[#161922] border-r border-gray-800 flex flex-col pt-4">
        <div className="px-6 mb-6"><h1 className="text-2xl font-bold text-orange-500 tracking-tight">DVMix</h1></div>
        <div className="flex-1 overflow-y-auto custom-scrollbar">{menuItems.map((item) => (<SidebarItem key={item.id} icon={item.icon} label={item.label} isActive={activeTab === item.id} onClick={() => setActiveTab(item.id)} />))}</div>
      </div>
      <div className="flex-1 flex flex-col h-full bg-[#1a1d26] overflow-hidden"><div className="flex-1 p-6 overflow-y-auto custom-scrollbar">{renderContent()}</div></div>
    </div>
  );
}