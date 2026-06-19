'use client';
import { supabase } from '../../lib/supabase';
export default function LoginPage(){
  const login=async()=>{ if(!supabase) return alert('Please configure Supabase environment values.'); await supabase.auth.signInWithOAuth({provider:'google',options:{redirectTo:`${location.origin}/`}}); };
  return <main><h1>WTK Online</h1><p>เข้าสู่ระบบก่อนเข้าสู่ Lobby</p><button onClick={login}>Login with Google</button></main>;
}
