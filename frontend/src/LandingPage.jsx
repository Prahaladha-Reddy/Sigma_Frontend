import React, { useState, useEffect } from 'react';
import { Auth } from '@supabase/auth-ui-react';
import { ThemeSupa } from '@supabase/auth-ui-shared';
import { 
  Sigma, 
  BarChart3, 
  UploadCloud, 
  LayoutTemplate, 
  Landmark, 
  FileSpreadsheet, 
  CheckCircle2, 
  ChevronLeft, 
  ChevronRight,
  X,
  Layers,
  ArrowRight,
  Sparkles,
  RefreshCcw
} from 'lucide-react';

// --- CONFIGURATION ---
const generateSlides = (folder, filenamePrefix, count) => {
  return Array.from({ length: count }, (_, i) => `/${folder}/${filenamePrefix}-images-${i}.jpg`);
};

const SHOWCASE_DECKS = [
    {
    id: 'batman',
    title: "Project: Gotham",
    subtitle: "Vigilante Strategy",
    type: "Strategy",
    color: "#52525b", // Zinc
    icon: <LayoutTemplate size={16} />,
    slides: generateSlides('batman_images', 'batman_main', 11) 
  },
    {
    id: 'space',
    title: "Space Tech 2030",
    subtitle: "Propulsion Systems",
    type: "Scientific",
    color: "#9333ea", // Purple
    icon: <UploadCloud size={16} />,
    slides: generateSlides('space_tech_images', 'space_tech', 18)
  },
  {
    id: 'roko',
    title: "RoKo: The Titans",
    subtitle: "Statistical Deep Dive",
    type: "Sports Analytics",
    color: "#2563eb", // Blue
    icon: <BarChart3 size={16} />,
    slides: generateSlides('RoKo_images', 'RoKo', 15) 
  },
    {
    id: 'covid',
    title: "COVID-19 Impact",
    subtitle: "Recovery Curves",
    type: "Public Health",
    color: "#e11d48", // Rose
    icon: <CheckCircle2 size={16} />,
    slides: generateSlides('covid_19_images', 'covid_19', 15)
  },

  {
    id: 'arch',
    title: "Renaissance Art",
    subtitle: "Structural Analysis",
    type: "History & Art",
    color: "#d97706", // Amber
    icon: <Landmark size={16} />,
    slides: generateSlides('Renissence_architecure_images', 'architecture_main (1)', 13)
  },
  {
    id: 'pharma',
    title: "Pharma Outlook",
    subtitle: "Q4 Market Trends",
    type: "Corporate",
    color: "#059669", // Emerald
    icon: <FileSpreadsheet size={16} />,
    slides: generateSlides('pharma_images', 'pharma_main', 15)
  }
];

export default function LandingPage({ supabaseClient }) {
  const [activeDeckIndex, setActiveDeckIndex] = useState(0);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [showAuth, setShowAuth] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [feedItems, setFeedItems] = useState([]);
  const [feedStatus, setFeedStatus] = useState('loading');

  const CLOUD_FEED = { cloud: 'dngvrfbdj', tag: 'public_feed' };

  const activeDeck = SHOWCASE_DECKS[activeDeckIndex];

  useEffect(() => { setCurrentSlide(0); }, [activeDeckIndex]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight') nextSlide();
      if (e.key === 'ArrowLeft') prevSlide();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSlide, activeDeck]);

  const nextSlide = () => {
    if (currentSlide < activeDeck.slides.length - 1) setCurrentSlide(prev => prev + 1);
  };

  const prevSlide = () => {
    if (currentSlide > 0) setCurrentSlide(prev => prev - 1);
  };

  const fetchFeed = async () => {
    setFeedStatus('loading');
    try {
      const res = await fetch(
        `https://res.cloudinary.com/${CLOUD_FEED.cloud}/image/list/${CLOUD_FEED.tag}.json`,
        { headers: { 'Cache-Control': 'no-cache' } }
      );
      if (!res.ok) throw new Error('feed load');
      const data = await res.json();
      const items = (data.resources || []).map((r) => ({
        id: r.public_id,
        thumb: `https://res.cloudinary.com/${CLOUD_FEED.cloud}/image/upload/f_auto,q_auto,w_640/${r.public_id}.jpg`,
        url: `https://res.cloudinary.com/${CLOUD_FEED.cloud}/image/upload/${r.public_id}.${r.format || 'pdf'}`
      }));
      setFeedItems(items);
      setFeedStatus('ready');
    } catch (err) {
      setFeedStatus('error');
    }
  };

  useEffect(() => {
    fetchFeed();
  }, []);

  // --- AUTH MODAL ---
  if (showAuth) {
    return (
      <div className="fixed inset-0 bg-black flex items-center justify-center z-50 overflow-hidden">
        <div 
          className="absolute inset-0 opacity-30 transition-colors duration-1000"
          style={{ background: `radial-gradient(circle at 50% 50%, ${activeDeck.color}, #000000)` }}
        />
        <div className="w-full max-w-md bg-zinc-950/90 backdrop-blur-2xl border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
          <button onClick={() => setShowAuth(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition">
            <X size={20} />
          </button>
          <div className="flex flex-col items-center mb-8">
            <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-black mb-4 shadow-[0_0_20px_rgba(255,255,255,0.2)]">
              <Sigma size={28} />
            </div>
            <h2 className="text-2xl font-bold text-white">Sign In</h2>
            <p className="text-zinc-400 text-sm">Access your presentation workspace.</p>
          </div>
          <Auth 
            supabaseClient={supabaseClient} 
            appearance={{ 
              theme: ThemeSupa, 
              variables: { 
                default: { 
                  colors: { 
                    brand: '#27272a', // Darker button background (zinc-800)
                    brandAccent: '#3f3f46', // Lighter on hover (zinc-700)
                    brandButtonText: 'white', // White text
                    inputBackground: '#09090b', 
                    inputBorder: '#27272a', 
                    inputText: 'white' 
                  }, 
                  radii: { 
                    borderRadiusButton: '12px', 
                    inputBorderRadius: '12px', 
                  } 
                } 
              } 
            }} 
            theme="dark" 
            providers={[]} 
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black font-sans text-white overflow-x-hidden">
      
      {/* =========================================
          SECTION 1: INTRO HERO
      ========================================= */}
      <section className="relative pt-24 pb-12 px-6 flex flex-col items-center text-center z-10">
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-white/5 blur-[100px] rounded-full pointer-events-none" />

        <div className="flex items-center gap-3 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-black shadow-[0_0_30px_rgba(255,255,255,0.3)]">
            <Sigma size={28} />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">SigΣa</h1>
        </div>

        <h2 className="text-4xl md:text-5xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-zinc-500 max-w-2xl leading-tight animate-in fade-in slide-in-from-bottom-6 duration-1000 delay-100">
          Beautiful presentations. Zero effort.
        </h2>
        
        <p className="text-zinc-400 text-lg max-w-lg mb-8 animate-in fade-in slide-in-from-bottom-8 duration-1000 delay-200">
          Upload your files and let our AI architect the narrative. No formatting required.
        </p>
        </section>


        {/* =========================================
            SECTION 2: THE STUDIO (VIEWER) - MAXIMIZED
        ========================================= */}
          <section className="relative w-full min-h-screen border-y border-white/5 bg-zinc-950/50">
          
          <div 
            className="absolute inset-0 transition-colors duration-1000 ease-in-out pointer-events-none z-0"
            style={{ 
              background: `radial-gradient(circle at 65% 50%, ${activeDeck.color}20 0%, transparent 70%)` 
            }}
          />
          <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 z-0 mix-blend-overlay pointer-events-none" />

          <div className="relative w-full h-full max-w-[1920px] mx-auto overflow-hidden px-4 md:px-0">

              <div className="flex flex-col md:flex-row h-[calc(100vh-160px)] md:h-[calc(100vh-120px)] lg:h-[80vh] gap-4 md:gap-0">

                {/* A. LEFT SIDEBAR (desktop) */}
                <aside className="hidden md:flex w-64 bg-zinc-900/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-30 flex-col overflow-hidden">
                  <div className="p-5 border-b border-white/5 flex items-center gap-2 bg-white/5">
                    <Layers size={14} className="text-zinc-400"/>
                    <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Demo Library</span>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                    {SHOWCASE_DECKS.map((deck, idx) => (
                      <button
                        key={deck.id}
                        onClick={() => setActiveDeckIndex(idx)}
                        className={`w-full text-left p-3 rounded-xl transition-all duration-300 border group relative overflow-hidden
                          ${activeDeckIndex === idx 
                            ? 'bg-white/10 border-white/20 shadow-lg' 
                            : 'bg-transparent border-transparent hover:bg-white/5 hover:border-white/5'}
                        `}
                      >
                        {activeDeckIndex === idx && (
                          <div className="absolute left-0 top-0 bottom-0 w-1 transition-all" style={{ backgroundColor: deck.color }} />
                        )}
                        <div className="flex items-start gap-3 pl-2">
                          <div className={`mt-0.5 transition-colors duration-300 ${activeDeckIndex === idx ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`} style={{ color: activeDeckIndex === idx ? deck.color : undefined }}>
                            {deck.icon}
                          </div>
                          <div className="overflow-hidden">
                            <h4 className={`text-xs font-bold leading-tight truncate ${activeDeckIndex === idx ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`}>
                              {deck.title}
                            </h4>
                            <p className="text-[10px] text-zinc-500 mt-1 truncate group-hover:text-zinc-400">
                              {deck.subtitle}
                            </p>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </aside>

                {/* B. MAIN SLIDE AREA */}
                <main className="relative flex-1 h-full rounded-3xl border border-white/10 bg-black/40 backdrop-blur-xl overflow-hidden shadow-2xl shadow-black/40">
                  
                  {/* Mobile library toggle */}
                  <div className="absolute top-4 left-4 z-30 flex gap-2 md:hidden">
                    <button
                      onClick={() => setSidebarOpen(true)}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-black/70 border border-white/10 text-sm"
                    >
                      <Layers size={16} /> Library
                    </button>
                  </div>

                  <div className="relative w-full h-full flex items-center justify-center group">
                    <img 
                      src={activeDeck.slides[currentSlide]} 
                      alt="Presentation Slide"
                      className="w-full h-full object-contain shadow-[0_0_60px_rgba(0,0,0,0.6)] rounded-md transition-transform duration-500"
                      onError={(e) => { e.target.onerror = null; e.target.src = "https://placehold.co/1920x1080/111/444?text=Preview+Generating..."; }}
                    />

                    <div className="absolute inset-y-0 left-0 w-1/4 cursor-w-resize z-10" onClick={prevSlide} />
                    <div className="absolute inset-y-0 right-0 w-1/4 cursor-e-resize z-10" onClick={nextSlide} />

                    {/* Controller - Bottom Center Overlay */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2 bg-zinc-950/80 backdrop-blur-xl border border-white/10 rounded-full shadow-2xl opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 transform translate-y-0 md:translate-y-4 md:group-hover:translate-y-0 z-20">
                      <button onClick={prevSlide} disabled={currentSlide === 0} className="p-1.5 hover:bg-white/20 rounded-full transition disabled:opacity-30"><ChevronLeft size={16} /></button>
                      <span className="text-[10px] font-mono font-medium text-white/80 w-12 text-center">
                        {currentSlide + 1} / {activeDeck.slides.length}
                      </span>
                      <button onClick={nextSlide} disabled={currentSlide === activeDeck.slides.length - 1} className="p-1.5 hover:bg-white/20 rounded-full transition disabled:opacity-30"><ChevronRight size={16} /></button>
                    </div>
                  </div>
                </main>

              </div>

          </div>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-50 md:hidden">
              <div className="absolute inset-0 bg-black/70" onClick={() => setSidebarOpen(false)} />
              <div className="relative h-full w-80 max-w-full bg-zinc-950 border-r border-white/10 p-4 flex flex-col gap-3 overflow-y-auto">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-semibold">
                    <Layers size={16} /> Demo Library
                  </div>
                  <button onClick={() => setSidebarOpen(false)} className="p-2 rounded-lg bg-white/5 hover:bg-white/10">
                    <X size={14} />
                  </button>
                </div>
                {SHOWCASE_DECKS.map((deck, idx) => (
                  <button
                    key={deck.id}
                    onClick={() => {
                      setActiveDeckIndex(idx);
                      setSidebarOpen(false);
                    }}
                    className={`w-full text-left p-3 rounded-xl transition-all duration-300 border group relative overflow-hidden
                      ${activeDeckIndex === idx 
                        ? 'bg-white/10 border-white/20 shadow-lg' 
                        : 'bg-transparent border-white/5 hover:bg-white/5'}
                    `}
                  >
                    {activeDeckIndex === idx && (
                      <div className="absolute left-0 top-0 bottom-0 w-1 transition-all" style={{ backgroundColor: deck.color }} />
                    )}
                    <div className="flex items-start gap-3 pl-2">
                      <div className={`mt-0.5 transition-colors duration-300 ${activeDeckIndex === idx ? 'text-white' : 'text-zinc-500 group-hover:text-zinc-300'}`} style={{ color: activeDeckIndex === idx ? deck.color : undefined }}>
                        {deck.icon}
                      </div>
                      <div className="overflow-hidden">
                        <h4 className={`text-xs font-bold leading-tight truncate ${activeDeckIndex === idx ? 'text-white' : 'text-zinc-400 group-hover:text-white'}`}>
                          {deck.title}
                        </h4>
                        <p className="text-[10px] text-zinc-500 mt-1 truncate group-hover:text-zinc-400">
                          {deck.subtitle}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

        </section>


        {/* =========================================
            SECTION 3: COMMUNITY FEED (PUBLIC)
        ========================================= */}
        <section className="relative px-6 py-12 md:py-16 border-y border-white/5 bg-black/60">
          <div className="max-w-6xl mx-auto flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.25em] text-zinc-300">
                <Sparkles size={14} /> Community feed
              </div>
              <h3 className="text-2xl font-semibold mt-1">Explore shared decks</h3>
              <p className="text-sm text-zinc-400">Tap to open previews instantly, no login required.</p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={fetchFeed}
                disabled={feedStatus === 'loading'}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-sm transition disabled:opacity-50"
              >
                <RefreshCcw size={14} className={feedStatus === 'loading' ? 'animate-spin' : ''} /> Refresh
              </button>
            </div>
          </div>

          {feedStatus === 'error' && (
            <div className="max-w-6xl mx-auto text-sm text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3">
              Could not load the feed. Please retry.
            </div>
          )}

          {feedStatus === 'loading' && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-48 rounded-xl bg-white/5 border border-white/10 animate-pulse" />
              ))}
            </div>
          )}

          {feedStatus === 'ready' && feedItems.length === 0 && (
            <div className="max-w-6xl mx-auto text-sm text-zinc-400 bg-black/40 border border-white/10 rounded-xl px-4 py-6">
              No community decks yet. Check back soon.
            </div>
          )}

          {feedItems.length > 0 && (
            <div className="max-w-6xl mx-auto grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {feedItems.map((item) => (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="group border border-white/10 bg-zinc-950/60 rounded-xl overflow-hidden hover:border-white/40 transition"
                >
                  <div className="aspect-video bg-white/5 overflow-hidden">
                    <img
                      src={item.thumb}
                      alt="Community deck preview"
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


      {/* =========================================
          SECTION 4: FOOTER CTA
      ========================================= */}
      <section className="py-24 px-6 text-center relative z-10">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl font-bold text-white mb-6">Ready to present?</h2>
          <p className="text-zinc-500 mb-8">
            Join and save hours every week.
          </p>
          
          <button 
            onClick={() => setShowAuth(true)}
            className="group relative inline-flex h-12 items-center justify-center overflow-hidden rounded-full bg-white px-8 font-medium text-black transition-all duration-300 hover:bg-zinc-200 hover:w-64 w-56 shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            <span className="mr-2">Start Making Presentations</span>
            <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
            <div className="absolute inset-0 -z-10 bg-gradient-to-r from-transparent via-zinc-300/50 to-transparent opacity-0 transition-opacity duration-500 group-hover:animate-shine" />
          </button>
        </div>
      </section>

    </div>
  );
}
