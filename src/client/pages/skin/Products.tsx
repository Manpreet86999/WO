import { useState, type FormEvent } from 'react';
import { EmptyState } from '../../components/ui';
import { Modal } from '../../components/Modal';
import { useApp } from '../../state/AppContext';
import { useToast } from '../../components/Toast';
import {
  CATEGORY_LABEL,
  PRODUCT_CATEGORIES,
  SKIN_PRODUCT_TEMPLATE,
  type ProductCategory,
} from '../../../shared/skin';

export function SkinProducts() {
  const app = useApp();
  const toast = useToast();
  const { skin, refreshSkin } = app;
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<'one' | 'json'>('one');
  const [busy, setBusy] = useState(false);
  const [jsonText, setJsonText] = useState('');
  const [form, setForm] = useState({
    name: '',
    brand: '',
    category: 'cleanser' as ProductCategory,
    actives: '',
    pros: '',
    cons: '',
    useCase: '',
    bestFor: '',
    usedInAm: true,
    usedInPm: true,
  });

  async function addOne(e: FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) return toast.push('Name the product', 'err');
    setBusy(true);
    try {
      await app.api.saveSkinProduct({
        name: form.name.trim(),
        brand: form.brand.trim(),
        category: form.category,
        actives: split(form.actives),
        usedIn: [form.usedInAm ? 'am' : null, form.usedInPm ? 'pm' : null].filter(Boolean) as Array<'am' | 'pm'>,
        status: 'active',
        notes: '',
        pros: split(form.pros),
        cons: split(form.cons),
        useCase: form.useCase.trim(),
        bestFor: split(form.bestFor),
        openedAt: '',
        expiresAt: '',
      });
      await refreshSkin();
      setForm({ name: '', brand: '', category: 'cleanser', actives: '', pros: '', cons: '', useCase: '', bestFor: '', usedInAm: true, usedInPm: true });
      setOpen(false);
      toast.push('Added', 'ok');
    } catch (err) {
      toast.push((err as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  function downloadTemplate() {
    const blob = new Blob([JSON.stringify(SKIN_PRODUCT_TEMPLATE, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'body-os-products-template.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function importJson() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonText);
    } catch {
      return toast.push('JSON is not valid', 'err');
    }
    setBusy(true);
    try {
      const res = await app.api.importSkinProducts(parsed);
      await refreshSkin();
      toast.push(`Imported ${res.imported}, skipped ${res.skipped}`, res.imported ? 'ok' : 'info');
      if (res.imported) {
        setOpen(false);
        setJsonText('');
      }
    } catch (e) {
      toast.push((e as Error).message, 'err');
    } finally {
      setBusy(false);
    }
  }

  async function onFile(file: File | null) {
    if (!file) return;
    setJsonText(await file.text());
  }

  async function remove(id: string) {
    await app.api.deleteSkinProduct(id);
    await refreshSkin();
  }

  return (
    <div className="fade page-shell skin-os">
      <header className="page-hero">
        <div>
          <span className="page-eyebrow">Shelf</span>
          <h1 className="page-title">Products</h1>
          <p className="page-sub">A decision-ready shelf for routine building: ingredients, trade-offs, use cases, and skin fit.</p>
        </div>
        <button type="button" className="skin-plus" onClick={() => setOpen(true)} aria-label="Add products">
          +
        </button>
      </header>

      {skin.products.length ? (
        <div className="stack">
          {skin.products.map((p) => (
            <article key={p.id} className="card skin-product-card" style={{ alignItems: 'flex-start' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <p className="page-eyebrow" style={{ margin: 0 }}>
                  {CATEGORY_LABEL[p.category] || p.category}
                </p>
                <h3 style={{ margin: '4px 0 0' }}>{p.name}</h3>
                <p className="subtle" style={{ margin: '4px 0 0' }}>
                  {[p.brand, p.usedIn.map((s) => s.toUpperCase()).join('/'), p.actives.join(', ')].filter(Boolean).join(' · ')}
                </p>
                <div className="skin-product-details">
                  <div><b>Use case</b><span>{p.useCase || 'Add the job this product does so the coach can place it correctly.'}</span></div>
                  <div><b>Best for</b><span>{p.bestFor?.length ? p.bestFor.join(' · ') : 'Not specified'}</span></div>
                  <div><b>Pros</b><span>{p.pros?.length ? p.pros.join(' · ') : 'Not specified'}</span></div>
                  <div><b>Cons / cautions</b><span>{p.cons?.length ? p.cons.join(' · ') : 'Not specified'}</span></div>
                </div>
              </div>
              <button type="button" className="btn btn-soft btn-sm" onClick={() => void remove(p.id)}>
                Remove
              </button>
            </article>
          ))}
        </div>
      ) : (
        <EmptyState
          title="Nothing on the shelf"
          body="Tap + to add one product or import a JSON list. Then ask the coach to build your routine."
          action={
            <button type="button" className="btn btn-hot" onClick={() => setOpen(true)}>
              Add products
            </button>
          }
        />
      )}

      <Modal
        open={open}
        title="Add products"
        onClose={() => setOpen(false)}
        actions={
          tab === 'json' ? (
            <>
              <button type="button" className="btn btn-soft" onClick={downloadTemplate}>
                Download JSON template
              </button>
              <button type="button" className="btn btn-hot" disabled={busy || !jsonText.trim()} onClick={() => void importJson()}>
                {busy ? 'Importing…' : 'Import'}
              </button>
            </>
          ) : undefined
        }
      >
        <div className="row" style={{ marginBottom: 12 }}>
          <button type="button" className={`btn btn-sm ${tab === 'one' ? 'btn-hot' : 'btn-soft'}`} onClick={() => setTab('one')}>
            One product
          </button>
          <button type="button" className={`btn btn-sm ${tab === 'json' ? 'btn-hot' : 'btn-soft'}`} onClick={() => setTab('json')}>
            Import JSON
          </button>
        </div>
        {tab === 'one' ? (
          <form className="stack" onSubmit={addOne}>
            <input className="input" placeholder="Name" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            <input className="input" placeholder="Brand" value={form.brand} onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))} />
            <select className="input" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as ProductCategory }))}>
              {PRODUCT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </select>
            <input className="input" placeholder="Actives (optional)" value={form.actives} onChange={(e) => setForm((f) => ({ ...f, actives: e.target.value }))} />
            <textarea className="input" rows={2} placeholder="Use case — what job does this product do?" value={form.useCase} onChange={(e) => setForm((f) => ({ ...f, useCase: e.target.value }))} />
            <input className="input" placeholder="Best for (comma-separated: dry skin, redness…)" value={form.bestFor} onChange={(e) => setForm((f) => ({ ...f, bestFor: e.target.value }))} />
            <input className="input" placeholder="Pros (comma-separated)" value={form.pros} onChange={(e) => setForm((f) => ({ ...f, pros: e.target.value }))} />
            <input className="input" placeholder="Cons / cautions (comma-separated)" value={form.cons} onChange={(e) => setForm((f) => ({ ...f, cons: e.target.value }))} />
            <div className="row">
              <label className="chip">
                <input type="checkbox" checked={form.usedInAm} onChange={(e) => setForm((f) => ({ ...f, usedInAm: e.target.checked }))} /> AM
              </label>
              <label className="chip">
                <input type="checkbox" checked={form.usedInPm} onChange={(e) => setForm((f) => ({ ...f, usedInPm: e.target.checked }))} /> PM
              </label>
              <button className="btn btn-hot" type="submit" disabled={busy}>
                Save
              </button>
            </div>
          </form>
        ) : (
          <div className="stack">
            <p className="subtle" style={{ margin: 0 }}>
              Download the template, fill a <code>products</code> array, then paste or upload. Required field: <b>name</b>. Optional: brand, category, actives, usedIn (am/pm), status, notes, pros, cons, useCase, bestFor.
            </p>
            <input className="input" type="file" accept="application/json,.json" onChange={(e) => void onFile(e.target.files?.[0] || null)} />
            <textarea
              className="input"
              style={{ minHeight: 180, fontFamily: 'var(--mono)', fontSize: 12 }}
              placeholder='{"products":[{"name":"…","brand":"…","category":"cleanser","pros":["…"],"cons":["…"],"useCase":"…","bestFor":["…"]}]}'
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}

function split(v: string): string[] {
  return v
    .split(/[,;\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}
