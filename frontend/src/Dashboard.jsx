import React, { useEffect, useRef, useState } from 'react';
import axios from 'axios';
import {
  Sigma,
  Plus,
  History,
  Settings,
  LogOut,
  UploadCloud,
  FileSpreadsheet,
  FileCode,
  FileText,
  X,
  Loader2,
  LayoutTemplate,
  CheckCircle2,
  Download,
  Zap,
  Menu,
  Share2,
  Sparkles,
  RefreshCcw,
} from 'lucide-react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
const CLOUDINARY_CLOUD_NAME = 'dngvrfbdj';
const CLOUDINARY_UPLOAD_PRESET = 'community_upload';
const CLOUDINARY_FOLDER = 'community_pdfs';
const CLOUDINARY_TAG = 'public_feed';

export default function Dashboard({ session, supabaseClient }) {
  const [input, setInput] = useState('');
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [numSlides, setNumSlides] = useState(10);
  const [processId, setProcessId] = useState(null);
  const [processStatus, setProcessStatus] = useState('idle');
  const [downloadUrl, setDownloadUrl] = useState(null);
  const [activeTab, setActiveTab] = useState('new');
  const [navOpen, setNavOpen] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishStatus, setPublishStatus] = useState('idle');
  const [feedItems, setFeedItems] = useState([]);
  const [feedStatus, setFeedStatus] = useState('idle');

  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!processId) return;
    const channel = supabaseClient
      .channel('process-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'Process', filter: `process_id=eq.${processId}` },
        async (payload) => {
          const status = payload.new.status?.toLowerCase();
          setProcessStatus(status);
          if (status === 'completed' && payload.new.presentation_s3_url) {
            await handleCompletion(payload.new.presentation_s3_url);
          }
        }
      )
      .subscribe();
    return () => {
      supabaseClient.removeChannel(channel);
    };
  }, [processId, supabaseClient]);

  useEffect(() => {
    fetchFeed();
  }, []);

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

  const fetchFeed = async () => {
    setFeedStatus('loading');
    try {
      const { data } = await axios.get(
        `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/list/${CLOUDINARY_TAG}.json`,
        { headers: { 'Cache-Control': 'no-cache' } }
      );
      const items = (data.resources || []).map((r) => ({
        id: r.public_id,
        format: r.format || 'pdf',
        thumb: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/f_auto,q_auto,w_520/${r.public_id}.jpg`,
        url: `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${r.public_id}.${r.format || 'pdf'}`,
        createdAt: r.created_at,
      }));
      setFeedItems(items);
      setFeedStatus('ready');
    } catch (err) {
      console.error(err);
      setFeedStatus('error');
    }
  };

  const uploadFiles = async () => {
    if (selectedFiles.length === 0) return [];
    setIsUploading(true);
    try {
      const metadata = selectedFiles.map((f) => ({ file_name: f.name, file_type: f.type }));
      const { data: presignedList } = await axios.post(`${API_URL}/generate-presigned-urls`, { files: metadata });
      await Promise.all(
        presignedList.map((item, i) =>
          axios.put(item.url, selectedFiles[i], { headers: { 'Content-Type': selectedFiles[i].type } })
        )
      );
      const dbRows = presignedList.map((item) => ({
        file_name: item.original_name,
        file_type: item.type,
        s3_key: item.key,
        user_id: session.user.id,
      }));
      const { data: dbData } = await supabaseClient.from('files').insert(dbRows).select();
      return dbData.map((row) => row.id);
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
    setPublishStatus('idle');
    setIsPublishing(false);
    const uploadedIds = await uploadFiles();
    if (selectedFiles.length > 0 && uploadedIds.length === 0) {
      setProcessStatus('error');
      return;
    }
    try {
      const { data } = await axios.post(`${API_URL}/chat`, {
        message: input,
        file_ids: uploadedIds,
        num_slides: numSlides,
        user_id: session.user.id,
      });
      if (data.process_id) setProcessId(data.process_id);
      else setProcessStatus('error');
    } catch (e) {
      setProcessStatus('error');
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files?.length) {
      setSelectedFiles((prev) => [...prev, ...Array.from(e.target.files)].slice(0, 5));
    }
  };

  const publishToCommunity = async () => {
    if (!downloadUrl || isPublishing) return;
    setIsPublishing(true);
    setPublishStatus('publishing');
    try {
      await axios.post(
        `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`,
        {
          file: downloadUrl,
          upload_preset: CLOUDINARY_UPLOAD_PRESET,
          folder: CLOUDINARY_FOLDER,
          tags: [CLOUDINARY_TAG],
          resource_type: 'auto',
        },
        { headers: { 'Content-Type': 'application/json' } }
      );
      setPublishStatus('published');
    } catch (err) {
      console.error(err);
      setPublishStatus('error');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#050505] via-[#0a0a0a] to-black text-white">
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-25 pointer-events-none" />
      <div className="absolute -top-32 -left-10 h-80 w-80 bg-white/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute -bottom-32 -right-10 h-80 w-80 bg-white/10 blur-[120px] rounded-full pointer-events-none" />

      <header className="sticky top-0 z-40 border-b border-white/10 bg-black/50 backdrop-blur-lg">
        <div className="max-w-6xl mx-auto px-4 md:px-6 flex items-center justify-between py-3 gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setNavOpen(true)}
              className="lg:hidden inline-flex items-center justify-center h-10 w-10 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition"
            >
              <Menu size={18} />
            </button>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/10 flex items-center justify-center shadow-lg shadow-white/10">
                <Sigma size={20} />
              </div>
              <div>
                <p className="text-sm uppercase tracking-[0.25em] text-zinc-200 flex items-center gap-1">
                  <Sparkles size={14} /> Sigma
                </p>
                <p className="text-base font-semibold">Adaptive deck architect</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
              <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-semibold">
                {session.user.email[0].toUpperCase()}
              </div>
              <span className="hidden sm:block text-xs text-zinc-300 max-w-[140px] truncate">{session.user.email}</span>
            </div>
          </div>
        </div>
      </header>

      {navOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/70" onClick={() => setNavOpen(false)} />
          <div className="relative ml-auto h-full w-72 bg-slate-950/90 border-l border-white/10 backdrop-blur-xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center">
                  <Sigma size={16} />
                </div>
                <span className="text-sm font-semibold">Navigation</span>
              </div>
              <button onClick={() => setNavOpen(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
                <X size={14} />
              </button>
            </div>
            <button
              onClick={() => {
                setActiveTab('new');
                setNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition ${
                activeTab === 'new'
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <Plus size={16} /> Home
            </button>
            <button
              onClick={() => {
                setActiveTab('history');
                setNavOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition ${
                activeTab === 'history'
                  ? 'bg-white/10 border-white/20 text-white'
                  : 'bg-white/5 border-white/5 text-zinc-400 hover:text-white'
              }`}
            >
              <History size={16} /> History
            </button>
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border border-white/5 text-sm text-zinc-400 hover:text-white bg-white/5">
              <Settings size={16} /> Settings
            </button>
            <div className="mt-auto pt-3 border-t border-white/5">
              <button
                onClick={() => supabaseClient.auth.signOut()}
                className="w-full flex items-center justify-center gap-2 text-sm text-zinc-400 hover:text-red-400 py-2 rounded-lg bg-white/5 hover:bg-white/10 transition"
              >
                <LogOut size={14} /> Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      <main className="relative z-10">
        <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 lg:py-8">
          <div className="flex flex-col gap-2 mb-6 md:mb-8">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.3em] text-zinc-300">
              <span className="h-[1px] w-8 bg-white/60" />
              Create presentation
            </div>
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Tell a story with your data.</h1>
                <p className="text-sm md:text-base text-zinc-400 mt-2">
                  Upload CSV, notebooks, or PDFs and let Sigma architect an executive-ready deck.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-5 lg:gap-6 xl:grid-cols-[1.65fr_1fr]">
            <div className="space-y-5 lg:space-y-6">
              <section className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-lg shadow-2xl shadow-white/5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center text-xs font-bold">
                      1
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">Data sources</h3>
                      <p className="text-xs text-zinc-400">Attach up to 5 files to shape the deck.</p>
                    </div>
                  </div>
                  <span className="hidden sm:block text-[11px] font-mono text-zinc-400 border border-white/10 rounded-full px-3 py-1">
                    csv / pdf / ipynb
                  </span>
                </div>

                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border border-dashed border-white/15 bg-black/30 rounded-xl px-4 sm:px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 cursor-pointer hover:border-white/40 hover:bg-white/5 transition"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-12 w-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
                      <UploadCloud size={22} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">Drop or select files</p>
                      <p className="text-xs text-zinc-500">Up to 5 attachments accepted.</p>
                    </div>
                  </div>
                </div>
                <input type="file" multiple ref={fileInputRef} onChange={handleFileSelect} className="hidden" />

                {selectedFiles.length > 0 ? (
                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedFiles.map((file, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl border border-white/10 bg-white/5"
                      >
                        {file.name.endsWith('.csv') ? (
                          <FileSpreadsheet className="text-emerald-400" size={18} />
                        ) : file.name.endsWith('.ipynb') ? (
                          <FileCode className="text-amber-400" size={18} />
                        ) : (
                          <FileText className="text-zinc-300" size={18} />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-white truncate">{file.name}</p>
                          <p className="text-[10px] text-zinc-500">{(file.size / 1024).toFixed(0)} KB</p>
                        </div>
                        <button
                          onClick={() => setSelectedFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="text-zinc-500 hover:text-red-400 transition"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-zinc-500">No files attached yet.</p>
                )}
              </section>

              <section className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-lg shadow-2xl shadow-white/5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="h-8 w-8 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center text-xs font-bold">
                      2
                    </span>
                    <div>
                      <h3 className="text-sm font-semibold">Narrative & context</h3>
                      <p className="text-xs text-zinc-400">Audience, tone, and outcomes guide the deck.</p>
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">Slides: {numSlides}</span>
                </div>

                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ex: Build an executive summary of Q3 growth drivers for the board. Keep tone concise, include 2 slides on risks."
                  className="w-full min-h-[140px] p-4 bg-black/30 border border-white/10 rounded-xl focus:ring-2 focus:ring-white/30 focus:border-white/30 outline-none resize-y text-sm text-white placeholder:text-zinc-600 transition"
                />

                <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="w-full sm:w-auto">
                    <label className="text-[11px] font-semibold text-zinc-400 uppercase tracking-[0.2em]">Length</label>
                    <div className="mt-2 flex items-center gap-3">
                      <input
                        type="range"
                        min="5"
                        max="20"
                        value={numSlides}
                        onChange={(e) => setNumSlides(Number(e.target.value))}
                        className="w-40 accent-white"
                      />
                      <span className="px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs font-mono">
                        {numSlides} slides
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-zinc-400" />
                </div>

                <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-zinc-500">Keep it concise; we’ll do the heavy lifting.</p>
                  <button
                    onClick={handleGenerate}
                    disabled={isUploading || processStatus === 'processing'}
                    className="inline-flex items-center justify-center gap-2 bg-white text-black px-5 py-3 rounded-full font-semibold text-sm hover:bg-zinc-200 disabled:opacity-60 disabled:cursor-not-allowed transition shadow-lg shadow-white/10"
                  >
                    {isUploading || processStatus === 'processing' ? (
                      <>
                        <Loader2 className="animate-spin" size={16} /> Building
                      </>
                    ) : (
                      <>
                        <Zap size={16} className="fill-black" /> Generate deck
                      </>
                    )}
                  </button>
                </div>
              </section>
            </div>

            <aside className="space-y-4 xl:sticky xl:top-28">
              <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 backdrop-blur-lg shadow-2xl shadow-white/5">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="text-sm font-semibold">Status & output</h3>
                  {processStatus === 'processing' && (
                    <span className="flex items-center gap-2 text-[11px] text-zinc-200">
                      <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
                      Processing
                    </span>
                  )}
                  {processStatus === 'completed' && <span className="text-[11px] text-emerald-300">Ready</span>}
                  {processStatus === 'error' && <span className="text-[11px] text-red-300">Error</span>}
                </div>

                <div className="rounded-xl border border-white/5 bg-black/30 p-4 text-center flex flex-col gap-4">
                  {processStatus === 'idle' && (
                    <div className="text-zinc-500 flex flex-col items-center gap-3">
                      <div className="h-14 w-14 rounded-2xl border border-dashed border-zinc-700 flex items-center justify-center bg-white/5">
                        <LayoutTemplate size={22} className="opacity-60" />
                      </div>
                      <div>
                        <p className="text-sm text-zinc-300">System ready</p>
                        <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-500">Waiting for input</p>
                      </div>
                    </div>
                  )}

                  {processStatus === 'processing' && (
                    <div className="flex flex-col gap-4 text-left">
                      <div className="flex items-center gap-3">
                        <div className="relative h-12 w-12">
                          <div className="absolute inset-0 border-2 border-white/10 rounded-full" />
                          <div className="absolute inset-0 border-2 border-white/50 rounded-full border-t-transparent animate-spin" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Sigma size={18} className="text-white" />
                          </div>
                        </div>
                        <div>
                          <p className="font-semibold">Architecting deck...</p>
                          <p className="text-xs text-zinc-500">A few moments typically.</p>
                        </div>
                      </div>
                      <div className="space-y-3 pl-2 border-l border-white/5 text-xs text-zinc-400">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-white" />
                          Job queued
                        </div>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 size={14} className="text-white" />
                          Parsing data structure
                        </div>
                        <div className="flex items-center gap-2 text-white font-medium">
                          <Loader2 size={14} className="animate-spin text-white" />
                          Generating narrative
                        </div>
                      </div>
                    </div>
                  )}

                  {processStatus === 'completed' && (
                    <div className="flex flex-col gap-3">
                      <div className="flex items-center justify-center gap-2 text-emerald-300 text-sm">
                        <CheckCircle2 size={18} />
                        Presentation ready
                      </div>
                      {downloadUrl ? (
                        <a
                          href={downloadUrl}
                          className="w-full inline-flex items-center justify-center gap-2 bg-white text-black py-3 rounded-xl font-semibold hover:bg-zinc-200 transition shadow-lg shadow-white/10"
                        >
                          <Download size={16} /> Download PDF
                        </a>
                      ) : (
                        <button className="w-full inline-flex items-center justify-center gap-2 bg-zinc-800 text-zinc-500 py-3 rounded-xl font-medium cursor-not-allowed">
                          <Loader2 size={16} className="animate-spin" /> Finalizing...
                        </button>
                      )}
                      <button
                        onClick={publishToCommunity}
                        disabled={!downloadUrl || isPublishing || publishStatus === 'published'}
                        className="w-full inline-flex items-center justify-center gap-2 bg-white/10 text-white py-3 rounded-xl font-semibold hover:bg-white/20 transition disabled:opacity-60 disabled:cursor-not-allowed border border-white/30"
                      >
                        {publishStatus === 'published' ? (
                          <>
                            <CheckCircle2 size={16} /> Added to community
                          </>
                        ) : publishStatus === 'publishing' ? (
                          <>
                            <Loader2 size={16} className="animate-spin" /> Publishing...
                          </>
                        ) : (
                          <>
                            <Share2 size={16} /> Publish to community feed
                          </>
                        )}
                      </button>
                      {publishStatus === 'error' && (
                        <p className="text-[11px] text-red-300 text-center">Upload failed. Please retry.</p>
                      )}
                      <p className="text-[11px] text-zinc-500 text-center">Share-ready for the community feed.</p>
                    </div>
                  )}

                  {processStatus === 'error' && (
                    <div className="flex flex-col items-center gap-3 text-red-300">
                      <div className="h-12 w-12 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                        <X size={20} />
                      </div>
                      <p className="font-semibold">Generation failed</p>
                      <button
                        onClick={() => setProcessStatus('idle')}
                        className="text-xs text-red-100 underline hover:text-white"
                      >
                        Reset system
                      </button>
                    </div>
                  )}
                </div>
              </div>

            </aside>
          </div>

          <section className="mt-8 bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-6 backdrop-blur-lg shadow-2xl shadow-white/5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] uppercase tracking-[0.25em] text-zinc-300">Community feed</p>
                <h3 className="text-xl font-semibold mt-1">Recently published decks</h3>
                <p className="text-sm text-zinc-400">Browse the latest shared decks.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={fetchFeed}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition"
                  disabled={feedStatus === 'loading'}
                >
                  <RefreshCcw size={14} className={feedStatus === 'loading' ? 'animate-spin' : ''} /> Refresh
                </button>
              </div>
            </div>

            {feedStatus === 'error' && (
              <div className="text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
                Could not load community feed. Please retry.
              </div>
            )}

            {feedStatus === 'loading' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse bg-white/5 border border-white/10 rounded-xl h-48" />
                ))}
              </div>
            )}

            {feedStatus === 'ready' && feedItems.length === 0 && (
              <div className="text-sm text-zinc-400 bg-black/30 border border-white/10 rounded-xl px-4 py-6 text-center">
                No public decks yet. Publish one to populate the feed.
              </div>
            )}

            {feedItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {feedItems.map((item) => (
                  <a
                    key={item.id}
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="group border border-white/10 bg-black/30 rounded-xl overflow-hidden hover:border-white/40 transition"
                  >
                    <div className="aspect-video bg-white/5 overflow-hidden">
                      <img
                        src={item.thumb}
                        alt={item.id}
                        loading="lazy"
                        className="w-full h-full object-cover group-hover:scale-[1.02] transition"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                      />
                    </div>
                    <div className="p-3 text-xs text-white flex items-center justify-center gap-2">
                      <Sparkles size={14} /> View deck
                    </div>
                  </a>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
