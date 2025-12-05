import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { supabase } from './supabaseClient';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import './App.css';
import {
  LayoutTemplate,
  FileText,
  UploadCloud,
  X,
  Plus,
  ArrowRight,
  Loader2,
  CheckCircle2,
  Download,
  LogOut,
  Settings,
  History,
  FileSpreadsheet,
  Sigma
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function App() {
  const [session, setSession] = useState(null);
  
  // App State
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [numSlides, setNumSlides] = useState(12);
  
  // Process State
  const [processId, setProcessId] = useState(null);
  const [processStatus, setProcessStatus] = useState('idle');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('new');

  const fileInputRef = useRef(null);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  // --- UPDATED: Realtime Listener ---
  useEffect(() => {
    if (!processId) return;

    console.log("Listening for updates on process:", processId);

    const channel = supabase.channel('process-updates')
      .on('postgres_changes', 
        { 
          event: 'UPDATE', 
          schema: 'public', 
          table: 'Process', 
          filter: `process_id=eq.${processId}` 
        },
        async (payload) => {
          console.log("Realtime update received:", payload);
          const status = payload.new.status?.toLowerCase();
          setProcessStatus(status);

          // Trigger download flow ONLY when completed AND url is present
          if (status === 'completed' && payload.new.presentation_s3_url) {
             await handleCompletion(payload.new.presentation_s3_url);
          }
        }
      ).subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [processId]);

  // --- UPDATED: Handle Completion & Download Handshake ---
  const handleCompletion = async (s3Url) => {
    try {
      console.log("Fetching download URL for:", s3Url);
      
      // Hit the specific endpoint to get a signed URL
      const res = await axios.post(`${API_URL}/generate-download-url`, { file_url: s3Url });
      const { download_url } = res.data;

      setDownloadUrl(download_url);
      
      // Auto download trigger
      const link = document.createElement('a');
      link.href = download_url;
      link.setAttribute('download', 'SigSigma_Presentation.pptx');
      document.body.appendChild(link);
      link.click();
      link.remove();
      
    } catch (err) {
      console.error("Error fetching download link:", err);
      // Keep status as completed, but maybe show an error toast if you had one
      // setProcessStatus('error'); // Optional: decide if you want to show error state or just log it
    }
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return [];
    setIsUploading(true);
    try {
      const metadata = selectedFiles.map(f => ({ file_name: f.name, file_type: f.type }));
      
      // 1. Get Presigned URLs
      const { data: presignedList } = await axios.post(`${API_URL}/generate-presigned-urls`, { files: metadata });
      
      // 2. Upload to S3
      await Promise.all(presignedList.map((item, i) => 
        axios.put(item.url, selectedFiles[i], { headers: { 'Content-Type': selectedFiles[i].type } })
      ));

      // 3. Save to Supabase 'files' table
      const dbRows = presignedList.map(item => ({
        file_name: item.original_name, 
        file_type: item.type, 
        s3_key: item.key, 
        user_id: session.user.id
      }));
      
      const { data: dbData } = await supabase.from('files').insert(dbRows).select();
      return dbData.map(row => row.id);

    } catch (e) {
      console.error("Upload failed", e);
      alert('Upload failed');
      return [];
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    // Basic validation: Must have text input OR files
    if (!input && selectedFiles.length === 0) return;
    
    setProcessId(null);
    setDownloadUrl(null);
    setProcessStatus('processing');
    
    // Upload files first (if any)
    const uploadedIds = await uploadFiles();
    
    // If upload failed but user selected files, stop here
    if (selectedFiles.length > 0 && uploadedIds.length === 0) {
        setProcessStatus('error');
        return;
    }

    try {
      const { data } = await axios.post(`${API_URL}/chat`, {
        message: input,
        file_ids: uploadedIds, // This will be [] if no files, which is fine now
        num_slides: numSlides,
        user_id: session.user.id,
      });

      if (data.process_id) {
          setProcessId(data.process_id);
      } else {
          console.warn("No process_id returned");
          setProcessStatus('error');
      }

    } catch (e) {
      console.error(e);
      setProcessStatus('error');
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length) {
      setSelectedFiles(prev => [...prev, ...Array.from(e.target.files)].slice(0, 5));
    }
  };

  // --- Auth View ---
  if (!session) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-md rounded-2xl shadow-card border border-slate-200 p-8">
          <div className="flex items-center justify-center gap-3 mb-8">
            <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-primary-600/20">
              <Sigma size={28} />
            </div>
            <span className="text-3xl font-bold text-slate-900 tracking-tight">SigΣa</span>
          </div>
          <h2 className="text-2xl font-bold text-slate-900 mb-2 text-center">Welcome back</h2>
          <p className="text-slate-500 mb-8 text-center">Sign in to access your data workspace.</p>
          <Auth supabaseClient={supabase} appearance={{ theme: ThemeSupa, variables: { default: { colors: { brand: '#4f46e5', brandAccent: '#4338ca' } } } }} providers={['google', 'github']} />
        </div>
      </div>
    );
  }

  // --- Main App ---
  return (
    <div className="relative flex min-h-screen bg-transparent text-slate-900 font-sans overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-primary-50/70 via-white to-slate-50 -z-20" />
      <div className="absolute -top-40 right-10 h-72 w-72 rounded-full bg-primary-100/60 blur-3xl -z-10" />
      <div className="absolute -bottom-32 left-8 h-64 w-64 rounded-full bg-slate-200/50 blur-3xl -z-10" />

      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200 flex flex-col">
        <div className="p-6 flex items-center gap-3">
          <div className="w-8 h-8 bg-primary-600 rounded-lg flex items-center justify-center text-white">
            <Sigma size={20} />
          </div>
          <span className="font-bold text-xl text-slate-800 tracking-tight">SigΣa</span>
        </div>

        <nav className="flex-1 px-4 space-y-1">
          <button 
            onClick={() => setActiveTab('new')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'new' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <Plus size={18} /> New Project
          </button>
          <button 
            onClick={() => setActiveTab('history')}
            className={`w-full flex items-center gap-3 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === 'history' ? 'bg-primary-50 text-primary-700' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            <History size={18} /> History
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 text-sm font-medium text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Settings size={18} /> Settings
          </button>
        </nav>

        <div className="p-4 border-t border-slate-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-slate-500 text-xs font-bold">
              {session.user.email[0].toUpperCase()}
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-slate-900 truncate">{session.user.email}</p>
              <p className="text-xs text-slate-500">Free Plan</p>
            </div>
          </div>
          <button onClick={() => supabase.auth.signOut()} className="w-full flex items-center justify-center gap-2 text-sm text-slate-500 hover:text-red-600 transition-colors">
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-8 py-12">
          
          <header className="mb-10">
            <h1 className="text-3xl font-bold text-slate-900 mb-2">Create Presentation</h1>
            <p className="text-slate-500 text-lg">Turn your data files and reports into professional slide decks.</p>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Col: Setup */}
            <div className="lg:col-span-2 space-y-8">
              
              {/* 1. Data Source */}
              <div className="bg-white rounded-xl shadow-subtle border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                  <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs">1</div>
                    Data Sources
                  </h3>
                  <span className="text-xs text-slate-400 font-medium">CSV, PDF, TXT</span>
                </div>
                <div className="p-6">
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-200 rounded-xl p-8 flex flex-col items-center justify-center text-center cursor-pointer hover:border-primary-500 hover:bg-primary-50/30 transition-all group"
                  >
                    <div className="w-12 h-12 bg-white rounded-full shadow-sm border border-slate-100 flex items-center justify-center text-slate-400 group-hover:text-primary-600 group-hover:scale-110 transition-transform mb-3">
                      <UploadCloud size={24} />
                    </div>
                    <p className="text-sm font-medium text-slate-900">Click to upload files</p>
                    <p className="text-xs text-slate-500 mt-1">or drag and drop here</p>
                  </div>
                  <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

                  {selectedFiles.length > 0 && (
                    <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedFiles.map((file, i) => (
                        <div key={i} className="flex items-center p-3 rounded-lg border border-slate-200 bg-slate-50">
                          {file.name.endsWith('.csv') ? <FileSpreadsheet className="text-green-600 mr-3" size={20} /> : <FileText className="text-slate-500 mr-3" size={20} />}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 truncate">{file.name}</p>
                            <p className="text-xs text-slate-500">{(file.size / 1024).toFixed(0)} KB</p>
                          </div>
                          <button onClick={() => setSelectedFiles(prev => prev.filter((_, idx) => idx !== i))} className="text-slate-400 hover:text-red-500">
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 2. Context & Generate */}
              <div className="bg-white rounded-xl shadow-subtle border border-slate-200 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                   <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-slate-200 text-slate-600 flex items-center justify-center text-xs">2</div>
                    Narrative & Context
                  </h3>
                </div>
                <div className="p-6">
                  <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Describe the story you want to tell with this data. Who is the audience? What are the key takeaways?"
                    className="w-full h-32 p-4 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none resize-none text-slate-700 text-sm"
                  />
                  
                  <div className="mt-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Length</label>
                        <div className="flex items-center gap-2">
                          <input 
                            type="range" min="5" max="20" value={numSlides} 
                            onChange={(e) => setNumSlides(e.target.value)}
                            className="h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary-600 w-32"
                          />
                          <span className="text-sm font-bold text-slate-900">{numSlides} slides</span>
                        </div>
                      </div>
                    </div>

                    <button 
                      onClick={handleGenerate}
                      disabled={isUploading || processStatus === 'processing'}
                      className="bg-primary-600 text-white px-6 py-3 rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm flex items-center gap-2"
                    >
                      {isUploading ? <Loader2 className="animate-spin" size={20} /> : <div className="flex items-center gap-2">Generate Deck <ArrowRight size={18} /></div>}
                    </button>
                  </div>
                </div>
              </div>

            </div>

            {/* Right Col: Output Status */}
            <div className="lg:col-span-1">
              <div className="bg-white rounded-xl shadow-subtle border border-slate-200 h-full flex flex-col">
                <div className="p-4 border-b border-slate-100 flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">Output</h3>
                  {processStatus === 'processing' && <span className="flex h-2 w-2 rounded-full bg-primary-500 animate-pulse"></span>}
                </div>
                
                <div className="flex-1 p-6 flex flex-col items-center justify-center text-center">
                  
                  {processStatus === 'idle' && (
                    <div className="text-slate-400">
                      <LayoutTemplate size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-sm">Ready to generate.</p>
                      <p className="text-xs mt-1">Configure your files and prompts on the left.</p>
                    </div>
                  )}

                  {processStatus === 'processing' && (
                    <div className="w-full">
                      <div className="relative w-16 h-16 mx-auto mb-6">
                        <div className="absolute inset-0 border-4 border-slate-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-primary-600 rounded-full border-t-transparent animate-spin"></div>
                      </div>
                      <h4 className="text-lg font-semibold text-slate-900 mb-2">Generating...</h4>
                      <div className="space-y-3 text-left w-full mt-6">
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <CheckCircle2 size={16} className="text-primary-600" /> Queued Job
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-600">
                          <CheckCircle2 size={16} className="text-primary-600" /> Analyzing Input
                        </div>
                        <div className="flex items-center gap-3 text-sm text-slate-800 font-medium animate-pulse">
                          <Loader2 size={16} className="animate-spin text-primary-600" /> Building Slides
                        </div>
                      </div>
                    </div>
                  )}

                  {processStatus === 'completed' && (
                    <div className="w-full bg-green-50 rounded-xl p-6 border border-green-100">
                      <div className="w-12 h-12 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <CheckCircle2 size={24} />
                      </div>
                      <h4 className="text-lg font-bold text-slate-900 mb-1">Success!</h4>
                      <p className="text-sm text-slate-600 mb-6">Your presentation is ready.</p>
                      
                      {downloadUrl ? (
                        <a href={downloadUrl} className="block w-full bg-slate-900 text-white py-3 rounded-lg font-medium hover:bg-slate-800 transition shadow-lg flex items-center justify-center gap-2">
                          <Download size={18} /> Download .PPTX
                        </a>
                      ) : (
                        <button className="block w-full bg-slate-200 text-slate-500 py-3 rounded-lg font-medium cursor-not-allowed flex items-center justify-center gap-2">
                          <Loader2 size={18} className="animate-spin" /> Finalizing...
                        </button>
                      )}
                    </div>
                  )}

                  {processStatus === 'error' && (
                     <div className="text-red-500">
                        <p>Something went wrong.</p>
                        <button onClick={() => setProcessStatus('idle')} className="text-sm underline mt-2">Try Again</button>
                     </div>
                  )}

                </div>
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}

export default App;