import React from "react"
import { Link } from "react-router"
import { appConfig } from "../config"
export default function ResetPassword() {
  const token = new URLSearchParams(window.location.search).get("token") || ""
  const [password, setPassword] = React.useState("")
  const [confirmation, setConfirmation] = React.useState("")
  const [error, setError] = React.useState("")
  const [busy, setBusy] = React.useState(false)
  const [success, setSuccess] = React.useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (busy) return
    if (!token) { setError("El enlace no tiene un token. Solicitá otro desde el login."); return }
    if (password.length<6) { setError("La contraseña debe tener al menos 6 caracteres."); return }
    if (password!==confirmation) { setError("Las contraseñas no coinciden."); return }
    setBusy(true);setError("")
    try {
      const r = await fetch(appConfig.apiUrl+"/auth/reset-password",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token,new_password:password})})
      const data=await r.json();if(!r.ok||!data.success)throw Error(data.error||"No se pudo cambiar la contraseña.")
      setPassword("");setConfirmation("");setSuccess(true)
    } catch(e) { setError(e instanceof Error?e.message:"No se pudo conectar al servidor.") } finally { setBusy(false) }
  }
  const style: React.CSSProperties={width:"100%",height:44,border:"1px solid #d8ded8",borderRadius:12,padding:"0 12px",margin:"8px 0 20px"}
  return <main className="app-page"><section className="app-card"><img className="app-brand" src={appConfig.logoUrl} alt="Turnits"/><h1>{success?"Contraseña actualizada":"Elegí tu contraseña"}</h1>{success?<><p>Ya podés iniciar sesión con tu nueva contraseña.</p><Link className="app-button" to="/login">Iniciar sesión</Link></>:<form noValidate onSubmit={submit}><label>Nueva contraseña<input style={style} type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} /></label><label>Repetí la contraseña<input style={style} type="password" autoComplete="new-password" value={confirmation} onChange={e=>setConfirmation(e.target.value)} /></label>{error&&<p role="alert">{error}</p>}<button type="submit" className="app-button" disabled={busy}>{busy?"Guardando…":"Guardar contraseña"}</button></form>}</section></main>
}
