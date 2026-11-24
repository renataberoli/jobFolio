"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Download, LoaderCircle, Trash2, X } from "lucide-react";

export default function ProfileSettings({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [savedName, setSavedName] = useState(initialName);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [message, setMessage] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const cancel = useRef<HTMLButtonElement>(null);
  const busy = saving || exporting || deleting;

  useEffect(() => {
    if (confirming) { dialog.current?.showModal(); cancel.current?.focus(); }
    else dialog.current?.close();
  }, [confirming]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) });
      const data = await response.json() as { name: string; error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save your username.");
      setName(data.name); setSavedName(data.name); setMessage("Username saved.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not save your username."); }
    finally { setSaving(false); }
  }

  async function download() {
    setExporting(true); setError(""); setMessage("");
    try {
      const response = await fetch("/api/profile/export");
      if (!response.ok) { const data = await response.json() as { error?: string }; throw new Error(data.error || "Could not export your applications."); }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a"); link.href = url; link.download = "jobfolio-applications.csv"; link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("CSV downloaded.");
    } catch (error) { setError(error instanceof Error ? error.message : "Could not export your applications."); }
    finally { setExporting(false); }
  }

  async function remove() {
    setDeleting(true); setDeleteError("");
    try {
      const response = await fetch("/api/profile", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirmation: "delete" }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not delete your profile.");
      window.location.assign("/profiles");
    } catch (error) { setDeleteError(error instanceof Error ? error.message : "Could not delete your profile."); setDeleting(false); }
  }

  return <div className="app-shell"><div className="main-shell">
    <header className="topbar"><a className="navbar-brand" href="/" aria-label="Jobfolio home"><img src="/jobfolio-logo.svg" width={40} height={40} alt=""/><span>Jobfolio</span></a><a className="text-link" href="/">Back to applications</a></header>
    <main className="profile-settings">
      <div className="profile-settings-heading"><h1>Your profile<span>.</span></h1><a className="text-link" href="/profiles">Switch profile</a></div>
      <section className="profile-settings-card" aria-label="Profile settings">
        <form onSubmit={save} className="profile-name-form">
          <label htmlFor="profile-username">Username</label>
          <div className="profile-name-controls"><input id="profile-username" name="username" autoComplete="nickname" value={name} onChange={event => { setName(event.target.value); setMessage(""); }} required maxLength={60} disabled={busy}/><button className="primary" disabled={busy || !name.trim() || name.trim() === savedName}>{saving && <LoaderCircle size={16} className="spin"/>}{saving ? "Saving…" : "Save"}</button></div>
        </form>
        <div className="profile-export"><div><h2>Your data</h2><p>Download your applications as a CSV file.</p></div><button className="secondary" onClick={download} disabled={busy}>{exporting ? <LoaderCircle size={16} className="spin"/> : <Download size={16}/>} {exporting ? "Downloading…" : "Download CSV"}</button></div>
        {error && <p className="profile-feedback error" role="alert">{error}</p>}
        {message && <p className="profile-feedback" role="status">{message}</p>}
        <div className="profile-delete"><button className="delete-profile-button" disabled={busy} onClick={() => { setDeleteError(""); setConfirming(true); }}><Trash2 size={16}/> Delete profile</button></div>
      </section>
    </main>
    <dialog ref={dialog} className="delete-profile-dialog" aria-labelledby="delete-profile-title" aria-describedby="delete-profile-description" onCancel={event => { event.preventDefault(); if (!deleting) setConfirming(false); }} onClick={event => { if (event.target === event.currentTarget && !deleting) setConfirming(false); }}>
      <div className="modal-header"><h2 id="delete-profile-title">Delete profile?</h2><button className="icon-button" aria-label="Close confirmation" disabled={deleting} onClick={() => setConfirming(false)}><X size={20}/></button></div>
      <div className="delete-profile-content"><p id="delete-profile-description">This permanently deletes <strong>{savedName}</strong>, all its applications, and attached documents. This cannot be undone.</p><p>You can download your CSV before continuing.</p>{deleteError && <p className="error" role="alert">{deleteError}</p>}<div className="delete-profile-actions"><button ref={cancel} className="secondary" disabled={deleting} onClick={() => setConfirming(false)}>Cancel</button><button className="primary" disabled={deleting} onClick={remove}>{deleting ? <LoaderCircle size={16} className="spin"/> : <Trash2 size={16}/>} {deleting ? "Deleting…" : "Delete profile"}</button></div></div>
    </dialog>
  </div></div>;
}
