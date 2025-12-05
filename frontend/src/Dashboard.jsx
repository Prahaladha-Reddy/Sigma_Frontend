import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { 
  Sigma, Plus, History, Settings, LogOut, UploadCloud, 
  FileSpreadsheet, FileCode, FileText, X, Loader2, 
  ArrowRight, LayoutTemplate, CheckCircle2, Download,
  Layers, Zap
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export default function Dashboard({ session, supabaseClient }) {
  // --- STATE & LOGIC (PRESERVED) ---
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [numSlides, setNumSlides] = useState(10);
  const [processId, setProcessId] = useState(null);
  const [processStatus, setProcessStatus] = useState('idle');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('new');
  
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!processId) return;
    const channel = supabaseClient.channel('process-updates')
      .on('postgres_changes', 
        { event: 'UPDATE', schema: 'public', table: 'Process', filter: `process_id=eq.${processId}` },
        async (payload) => {
          const status = payload.new.status?.toLowerCase();
          setProcessStatus(status);
          if (status === 'completed' && payload.new.presentation_s3_url) {
             await handleCompletion(payload.new.presentation_s3_url);
          }
        }
      ).subscribe();
    return () => { supabaseClient.removeChannel(channel); };
  }, [processId, supabaseClient]);

  const handleCompletion = async (s3Url) => {
    try {
      const res = await axios.post(`${API_URL}/generate-download-url`, { file_url: s3Url });
      const { download_url } = res.data;
      setDownloadUrl(download_url);
      
      const link = document.createElement('a');
      link.href = download_url;
      link.setAttribute('download', 'SigSigma_Presentation.pptx');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error(err);
    }
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return [];
    setIsUploading(true);
    try {
      const metadata = selectedFiles.map(f => ({ file_name: f.name, file_type: f.type }));
      const { data: presignedList } = await axios.post(`${API_URL}/generate-presigned-urls`, { files: metadata });
      await Promise.all(presignedList.map((item, i) => 
        axios.put(item.url, selectedFiles[i], { headers: { 'Content-Type': selectedFiles[i].type } })
      ));
      const dbRows = presignedList.map(item => ({
        file_name: item.original_name, file_type: item.type, s3_key: item.key, user_id: session.user.id
      }));
      const { data: dbData } = await supabaseClient.from('files').insert(dbRows).select();
      return dbData.map(row => row.id);
    } catch (e) {
      alert('Upload failed');
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!input && selectedFiles.length === 0) return;
    setProcessId(null);
    setDownloadUrl(null);
    setProcessStatus('processing');
    const uploadedIds = await uploadFiles();
    if (selectedFiles.length > 0 && uploadedIds.length === 0) {
        setProcessStatus('error');
        return;
    }
    try {
      const { data } = await axios.post(`${API_URL}/chat`, {
        message: input, file_ids: uploadedIds, num_slides: numSlides, user_id: session.user.id,
      });
      if (data.process_id) setProcessId(data.process_id);
      else setProcessStatus('error');
    } catch (e) {
      setProcessStatus('error');
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)].slice(0, 5));
    }
  };

  // --- UI RENDER (FIXED LAYOUT) ---
  return (
    // Changed to fixed inset-0 to guarantee full screen coverage with no white bars
    <div className="fixed inset-0 bg-black font-sans text-white overflow-hidden flex selection:bg-indigo-500/30">
      
      {/* Background Ambience */}
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay pointer-events-none" />
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-500/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-500/10 blur-[120px] rounded-full pointer-events-none" />

      {/* --- SIDEBAR --- */}
      <aside className="fixed left-4 top-4 bottom-4 w-64 bg-zinc-900/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-30 flex flex-col overflow-hidden">
        {/* Logo */}
        <div className="p-5 border-b border-white/5 flex items-center gap-3 bg-white/5">
          <div className="w-8 h-8 bg-white/10 rounded-lg flex items-center justify-center border border-white/10">
            <Sigma size={18} />
          </div>
          <span className="font-bold text-lg tracking-tight">SigΣa</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <button onClick={() => setActiveTab('new')} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${activeTab === 'new' ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
            <Plus size={16} /> New Project
          </button>
          <button onClick={() => setActiveTab('history')} className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-xl transition-all ${activeTab === 'history' ? 'bg-white/10 text-white shadow-inner border border-white/5' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300'}`}>
            <History size={16} /> History
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium text-zinc-500 rounded-xl hover:bg-white/5 hover:text-zinc-300 transition-all">
            <Settings size={16} /> Settings
          </button>
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-white/5 bg-black/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-lg">
              {session.user.email[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-medium text-white truncate">{session.user.email}</p>
              <p className="text-[10px] text-zinc-500">Free Plan</p>
            </div>
          </div>
          <button onClick={() => supabaseClient.auth.signOut()} className="w-full flex items-center justify-center gap-2 text-xs font-medium text-zinc-500 hover:text-red-400 transition-colors py-2 rounded-lg hover:bg-white/5">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 ml-72 mr-4 my-4 relative z-10 overflow-hidden flex flex-col">
        <header className="mb-6 mt-2">
          <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">Create Presentation</h1>
          <p className="text-zinc-400">Turn raw data files into executive intelligence.</p>
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          
          {/* LEFT COLUMN: SETUP */}
          <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto pr-2 scrollbar-hide">
            
            {/* 1. Data Source Card */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shrink-0">
              <div className="px-6 py-4 border-b border-white/5 bg-white/5 flex justify-between items-center">
                <h3 className="font-semibold text-zinc-200 flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-xs border border-white/5">1</span>
                  Data Sources
                </h3>
                <span className="text-[10px] text-zinc-500 font-mono border border-white/5 px-2 py-0.5 rounded-full">CSV • PDF • IPYNB</span>
              </div>
              
              <div className="p-6">
                <div 
                  onClick={() => fileInputRef.current?.click()} 
                  className="border border-dashed border-zinc-700 bg-zinc-900/50 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-all group"
                >
                  <div className="w-12 h-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 group-hover:text-white group-hover:bg-indigo-600 transition-all mb-3 shadow-lg">
                    <UploadCloud size={20} />
                  </div>
                  <p className="text-sm font-medium text-zinc-300">Click to upload files</p>
                  <p className="text-xs text-zinc-600 mt-1">or drag and drop here</p>
                </div>
                <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

                {selectedFiles.length > 0 && (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedFiles.map((file, i) => (
                      <div key={i} className="flex items-center p-3 rounded-lg border border-white/5 bg-white/5">
                        {file.name.endsWith('.csv') ? (<FileSpreadsheet className="text-emerald-400 mr-3" size={18} />) : file.name.endsWith('.ipynb') ? (<FileCode className="text-amber-400 mr-3" size={18} />) : (<FileText className="text-indigo-400 mr-3" size={18} />)}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-200 truncate">{file.name}</p>
                          <p className="text-[10px] text-zinc-500">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-zinc-600 hover:text-red-400 transition"><X size={14} /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* 2. Narrative Card */}
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden shrink-0">
              <div className="px-6 py-4 border-b border-white/5 bg-white/5">
                 <h3 className="font-semibold text-zinc-200 flex items-center gap-2 text-sm">
                  <span className="w-5 h-5 rounded-full bg-zinc-800 text-zinc-400 flex items-center justify-center text-xs border border-white/5">2</span>
                  Narrative & Context
                </h3>
              </div>
              <div className="p-6">
                <textarea 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  placeholder="Describe the story you want to tell. Who is the audience? What are the key takeaways?" 
                  className="w-full h-32 p-4 bg-black/40 border border-white/10 rounded-xl focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 outline-none resize-none text-zinc-300 text-sm placeholder:text-zinc-700 transition-all" 
                />
                
                <div className="mt-6 flex items-center justify-between">
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Length</label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" min="5" max="20" value={numSlides} onChange={(e) => setNumSlides(e.target.value)} 
                        className="h-1.5 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-white w-32" 
                      />
                      <span className="text-xs font-mono text-zinc-300 w-16">{numSlides} slides</span>
                    </div>
                  </div>
                  
                  <button 
                    onClick={handleGenerate} 
                    disabled={isUploading || processStatus === 'processing'} 
                    className="bg-white text-black px-6 py-3 rounded-full font-bold text-sm hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-white/10 flex items-center gap-2"
                  >
                    {isUploading ? <Loader2 className="animate-spin" size={16} /> : <div className="flex items-center gap-2"><Zap size={16} className="fill-black" /> Generate Deck</div>}
                  </button>
                </div>
              </div>
            </div>
            
            {/* Bottom spacer for scroll */}
            <div className="h-4"></div>

          </div>

          {/* RIGHT COLUMN: OUTPUT */}
          <div className="lg:col-span-1">
            <div className="bg-zinc-900/40 backdrop-blur-md border border-white/10 rounded-2xl h-full flex flex-col overflow-hidden relative">
              <div className="px-6 py-4 border-b border-white/5 flex items-center justify-between">
                <h3 className="font-semibold text-zinc-200 text-sm">Console Output</h3>
                {processStatus === 'processing' && <span className="flex h-2 w-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_#6366f1]"></span>}
              </div>

              <div className="flex-1 p-6 flex flex-col items-center justify-center text-center relative">
                
                {/* IDLE STATE */}
                {processStatus === 'idle' && (
                  <div className="text-zinc-600">
                    <div className="w-16 h-16 rounded-2xl border border-dashed border-zinc-700 flex items-center justify-center mx-auto mb-4 bg-white/5">
                        <LayoutTemplate size={24} className="opacity-50" />
                    </div>
                    <p className="text-sm font-medium text-zinc-400">System Ready</p>
                    <p className="text-[10px] mt-1 text-zinc-600 uppercase tracking-widest">Waiting for input</p>
                  </div>
                )}

                {/* PROCESSING STATE */}
                {processStatus === 'processing' && (
                  <div className="w-full">
                    <div className="relative w-16 h-16 mx-auto mb-6">
                      <div className="absolute inset-0 border-2 border-white/10 rounded-full"></div>
                      <div className="absolute inset-0 border-2 border-indigo-500 rounded-full border-t-transparent animate-spin"></div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Sigma size={20} className="text-indigo-400 animate-pulse" />
                      </div>
                    </div>
                    <h4 className="text-lg font-bold text-white mb-1">Architecting Deck...</h4>
                    <p className="text-xs text-zinc-500">This usually takes about few moments</p>
                    
                    <div className="space-y-3 text-left w-full mt-8 pl-4 border-l border-white/5">
                      <div className="flex items-center gap-3 text-xs text-zinc-400"><CheckCircle2 size={14} className="text-indigo-500" /> Job Queued</div>
                      <div className="flex items-center gap-3 text-xs text-zinc-400"><CheckCircle2 size={14} className="text-indigo-500" /> Parsing Data Structure</div>
                      <div className="flex items-center gap-3 text-xs text-white font-medium animate-pulse"><Loader2 size={14} className="animate-spin text-indigo-500" /> Generative Narrative</div>
                    </div>
                  </div>
                )}

                {/* COMPLETED STATE */}
                {processStatus === 'completed' && (
                  <div className="w-full h-full flex flex-col justify-center">
                    <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                        <CheckCircle2 size={32} />
                    </div>
                    <h4 className="text-xl font-bold text-white mb-2">Complete</h4>
                    <p className="text-xs text-zinc-500 mb-8">Presentation generated successfully.</p>
                    
                    {downloadUrl ? (
                      <a href={downloadUrl} className="block w-full bg-white text-black py-4 rounded-xl font-bold hover:bg-zinc-200 transition shadow-lg flex items-center justify-center gap-2 group">
                        <Download size={18} className="group-hover:-translate-y-0.5 transition-transform" /> 
                        Download .PDF
                      </a>
                    ) : (
                      <button className="block w-full bg-zinc-800 text-zinc-500 py-4 rounded-xl font-medium cursor-not-allowed flex items-center justify-center gap-2">
                        <Loader2 size={18} className="animate-spin" /> Finalizing...
                      </button>
                    )}
                  </div>
                )}

                {/* ERROR STATE */}
                {processStatus === 'error' && (
                   <div className="text-red-400">
                      <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20">
                          <X size={24} />
                      </div>
                      <p className="font-bold">Generation Failed</p>
                      <button onClick={() => setProcessStatus('idle')} className="text-xs hover:text-white underline mt-4">Reset System</button>
                   </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}