import React, { useEffect, useState } from 'react';
import { supabase } from './supabaseClient';
import LandingPage from './LandingPage';
import Dashboard from './Dashboard';
import './App.css';

function App() {
  const [session, setSession] = useState(null);

  // Auth Listener
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => subscription.unsubscribe();
  }, []);

  if (!session) {
    return <LandingPage supabaseClient={supabase} />;
  }

  return <Dashboard session={session} supabaseClient={supabase} />;
}

export default App;