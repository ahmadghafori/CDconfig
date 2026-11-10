import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, Plus, RefreshCw, Save, Trash2, X } from 'lucide-react';
import { ClusterGetResult } from '../types/dataTypes';

type Realm = { guid: string; name: string; englishName?: string; isArchived?: boolean };
type Cloud = { isActive: boolean; provider: number; nsPrefix: string };

const REALM_QUERY = `query identityUserRealm($input: IdentityUserRealmQueryInput!) {
  identity_user_realm(input: $input) {
    statusCode message actionType mode requestId
    data { items { guid name realmType description createDate englishName environmentType id isArchived relateRealmGuid relateRealmName children { guid name realmType description createDate englishName environmentType id isArchived relateRealmGuid relateRealmName } } }
    subStatuses { subject subStatusCode message subActionType exception { message type stackTrace } }
  }
}`;
const UPDATE_MUTATION = `mutation cluster_UpdateClusterConfig($input: UpdateConfigCommandInput!) {
  cluster_UpdateClusterConfig(input: $input) {
    statusCode message subStatuses { subject subStatusCode message } data
  }
}`;
const field = 'w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none';
const label = 'mb-1 block text-[11px] text-slate-400';

export const ClusterConfigEditor: React.FC<{ cluster: ClusterGetResult; endpoint: string; authToken?: string; onClose: () => void; }> = ({ cluster, endpoint, authToken = '', onClose }) => {
  const config = cluster.clusterConfig || ({} as any);
  const argo: any = config.argoCD || {};
  const template = argo.applicationTemplate || {};
  const auto = template.syncpolicy?.automated || {};
  const [clusterType, setClusterType] = useState(Number(config.clusterType ?? 0));
  const [exposure, setExposure] = useState({ ingressClassName: config.exposure?.ingressClassName ?? 'nginx', gatewayName: config.exposure?.gatewayName ?? 'kasra-gateway', gatewayNamespace: config.exposure?.gatewayNamespace ?? 'gateway-system', gatewaySectionName: config.exposure?.gatewaySectionName ?? 'https' });
  const [domainZone, setDomainZone] = useState(config.kubernetes?.domainZone ?? '');
  const [clouds, setClouds] = useState<Cloud[]>((config.clouds || []).map((c: any) => ({ isActive: Boolean(c.isActive ?? c.IsActive), provider: Number(c.provider ?? c.Provider ?? 0), nsPrefix: c.nsPrefix ?? c.NsPrefix ?? '' })));
  const [address, setAddress] = useState(argo.address ?? '');
  const [user, setUser] = useState(argo.user ?? '');
  const [pass, setPass] = useState(argo.pass ?? '');
  const [token, setToken] = useState(argo.token ?? '');
  const [project, setProject] = useState(template.project ?? 'default');
  const [server, setServer] = useState(template.destination?.server ?? 'https://kubernetes.default.svc');
  const [prune, setPrune] = useState(Boolean(auto.prune ?? true));
  const [selfHeal, setSelfHeal] = useState(Boolean(auto.selfHeal ?? true));
  const [realms, setRealms] = useState<Realm[]>([]);
  const [loadingRealms, setLoadingRealms] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const authHeaders = (): Record<string, string> => {
    const tokenValue = authToken.trim();
    return tokenValue
      ? { Authorization: tokenValue.startsWith('Bearer ') ? tokenValue : `Bearer ${tokenValue}` }
      : {};
  };

  const refreshRealms = async () => {
    setLoadingRealms(true);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() }, cache: 'no-store', body: JSON.stringify({ query: REALM_QUERY, variables: { input: { realmType: 'SHARED' } }, operationName: 'identityUserRealm' }) });
      if (!response.ok) throw new Error(`دریافت Realm ناموفق بود: HTTP ${response.status}`);
      const json = await response.json();
      if (json.errors?.length) throw new Error(json.errors.map((e: any) => e.message).join(' | '));
      const result = json.data?.identity_user_realm;
      if (!result) throw new Error('پاسخ identity_user_realm معتبر نیست.');
      setRealms(result.data?.items || []);
      setNotice({ ok: true, text: `${(result.data?.items || []).length} Realm اشتراکی دریافت شد.` });
    } catch (e: any) {
      setNotice({ ok: false, text: e.message?.includes('Failed to fetch') ? 'اتصال GraphQL برقرار نشد؛ CORS و دسترسی شبکه را بررسی کنید.' : e.message });
    } finally { setLoadingRealms(false); }
  };
  useEffect(() => { void refreshRealms(); }, [endpoint, cluster.guid]);

  const updateCloud = (index: number, patch: Partial<Cloud>) => setClouds(items => items.map((item, i) => i === index ? { ...item, ...patch } : item));
  const save = async () => {
    if (!cluster.guid) return setNotice({ ok: false, text: 'clusterGuid موجود نیست.' });
    setSaving(true); setNotice(null);
    const input = {
      clusterGuid: cluster.guid,
      // GraphQL ClusterTypeEnum values are INGRESS, HTTP_ROUTE and OPEN_SHIFT.
      clusterType: (['INGRESS', 'HTTP_ROUTE', 'OPEN_SHIFT'] as const)[clusterType] ?? 'INGRESS',
      exposure,
      clouds: clouds.map(c => ({ isActive: c.isActive, provider: c.provider, nsPrefix: c.nsPrefix || null })),
      kubernetes: { domainZone: domainZone.trim() || null },
      argoCDAddress: address.trim() || null, argoCDUser: user.trim() || null,
      argoCDPass: pass || null, argoCDToken: token || null,
      project: project.trim() || 'default', destination: { server: server.trim() || 'https://kubernetes.default.svc' },
      automated: { prune, selfHeal },
    };
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json', ...authHeaders() }, body: JSON.stringify({ query: UPDATE_MUTATION, variables: { input }, operationName: 'cluster_UpdateClusterConfig' }) });
      if (!response.ok) throw new Error(`ثبت تنظیمات ناموفق بود: HTTP ${response.status}`);
      const json = await response.json();
      if (json.errors?.length) throw new Error(json.errors.map((e: any) => e.message).join(' | '));
      const result = json.data?.cluster_UpdateClusterConfig;
      if (!result) throw new Error('پاسخ Mutation معتبر نیست.');
      if (result.data !== true) {
        const sub = (result.subStatuses || []).map((s: any) => s.message).filter(Boolean).join(' | ');
        throw new Error(sub || result.message || 'سرور ثبت تنظیمات را تأیید نکرد (data=false).');
      }
      setNotice({ ok: true, text: result.message || 'تنظیمات کلاستر ثبت شد.' });
    } catch (e: any) {
      setNotice({ ok: false, text: e.message?.includes('Failed to fetch') ? 'ارسال GraphQL ناموفق بود؛ CORS و شبکه را بررسی کنید.' : e.message });
    } finally { setSaving(false); }
  };

  const realmsForPrefix = realms.filter(r => !r.isArchived);
  return <section className="space-y-3 rounded-xl border border-emerald-800/50 bg-slate-950/70 p-3">
    <div className="flex items-center justify-between gap-2"><div><h3 className="text-sm font-semibold text-emerald-300">ویرایش Cluster Config</h3><p className="mt-1 break-all font-mono text-[10px] text-slate-500">clusterGuid: {cluster.guid}</p></div><div className="flex items-center gap-1"><button type="button" onClick={onClose} className="rounded-lg border border-slate-700 p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white" title="بازگشت به کارت‌ها"><X className="h-3.5 w-3.5" /></button><button type="button" onClick={refreshRealms} disabled={loadingRealms} className="flex items-center gap-1 rounded-lg border border-slate-700 px-2 py-1.5 text-[10px] text-slate-300 disabled:opacity-50"><RefreshCw className={`h-3 w-3 ${loadingRealms ? 'animate-spin' : ''}`} /> Refresh Realm</button></div></div>
    <div><label className={label}>Cluster Type</label><select className={field} value={clusterType} onChange={e => setClusterType(Number(e.target.value))}><option value={0}>Ingress</option><option value={1}>HTTPRoute</option><option value={2}>OpenShift</option></select></div>
    <div className="space-y-2 rounded-lg border border-slate-800 p-3"><h4 className="text-xs font-semibold text-slate-300">Exposure</h4>{clusterType === 0 && <div><label className={label}>Ingress Class Name</label><input className={field} value={exposure.ingressClassName} onChange={e => setExposure(v => ({ ...v, ingressClassName: e.target.value }))} /></div>}{clusterType === 1 && <><div><label className={label}>Gateway Name</label><input className={field} value={exposure.gatewayName} onChange={e => setExposure(v => ({ ...v, gatewayName: e.target.value }))} /></div><div><label className={label}>Gateway Namespace</label><input className={field} value={exposure.gatewayNamespace} onChange={e => setExposure(v => ({ ...v, gatewayNamespace: e.target.value }))} /></div><div><label className={label}>Gateway Section Name</label><input className={field} value={exposure.gatewaySectionName} onChange={e => setExposure(v => ({ ...v, gatewaySectionName: e.target.value }))} /></div></>}</div>
    <div><label className={label}>Kubernetes Domain Zone</label><input className={field} dir="ltr" value={domainZone} onChange={e => setDomainZone(e.target.value)} placeholder="example.com" /></div>
    <div className="space-y-2 rounded-lg border border-slate-800 p-3"><div className="flex items-center justify-between"><h4 className="text-xs font-semibold text-slate-300">Clouds</h4><button type="button" onClick={() => setClouds(v => [...v, { isActive: true, provider: 0, nsPrefix: '' }])} className="flex items-center gap-1 text-[10px] text-emerald-400"><Plus className="h-3 w-3" /> Add</button></div>{clouds.map((c, i) => <div key={i} className="space-y-2 rounded-lg bg-slate-900 p-2"><div className="flex items-center justify-between text-[10px] text-slate-400">Cloud {i + 1}<button type="button" onClick={() => setClouds(v => v.filter((_, n) => n !== i))} className="text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button></div><div className="grid grid-cols-2 gap-2"><div><label className={label}>Provider</label><select className={field} value={c.provider} onChange={e => updateCloud(i, { provider: Number(e.target.value) })}><option value={0}>Abriment</option><option value={1}>ArvanCloud</option></select></div><label className="flex items-center gap-2 pt-5 text-xs text-slate-300"><input type="checkbox" checked={c.isActive} onChange={e => updateCloud(i, { isActive: e.target.checked })} /> Active</label></div><div><label className={label}>NsPrefix</label><input className={field} list={`realm-list-${cluster.guid}`} value={c.nsPrefix} onChange={e => updateCloud(i, { nsPrefix: e.target.value })} placeholder="Realm prefix" /><datalist id={`realm-list-${cluster.guid}`}>{realmsForPrefix.map(r => <option key={r.guid} value={r.englishName || r.name}>{r.name}</option>)}</datalist></div></div>)}{clouds.length === 0 && <p className="text-[10px] text-slate-500">Cloud تعریف نشده است.</p>}<p className="text-[10px] text-slate-500">{loadingRealms ? 'در حال دریافت Realmهای SHARED...' : 'Realmهای SHARED برای پیشنهاد NsPrefix دریافت می‌شوند؛ ورود دستی نیز ممکن است.'}</p></div>
    <div className="space-y-2 rounded-lg border border-slate-800 p-3"><h4 className="text-xs font-semibold text-slate-300">ArgoCD</h4><div><label className={label}>Address</label><input className={field} dir="ltr" value={address} onChange={e => setAddress(e.target.value)} /></div><div className="grid grid-cols-2 gap-2"><div><label className={label}>User</label><input className={field} dir="ltr" value={user} onChange={e => setUser(e.target.value)} /></div><div><label className={label}>Password</label><input className={field} type="password" dir="ltr" value={pass} onChange={e => setPass(e.target.value)} /></div></div><div><label className={label}>Token</label><input className={field} type="password" dir="ltr" value={token} onChange={e => setToken(e.target.value)} /></div></div>
    <div className="space-y-2 rounded-lg border border-slate-800 p-3"><h4 className="text-xs font-semibold text-slate-300">Application Template</h4><div><label className={label}>Project</label><input className={field} value={project} onChange={e => setProject(e.target.value)} /></div><div><label className={label}>Destination Server</label><input className={field} dir="ltr" value={server} onChange={e => setServer(e.target.value)} /></div><div className="flex gap-4"><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={prune} onChange={e => setPrune(e.target.checked)} /> Prune</label><label className="flex items-center gap-2 text-xs text-slate-300"><input type="checkbox" checked={selfHeal} onChange={e => setSelfHeal(e.target.checked)} /> Self Heal</label></div></div>
    {notice && <div className={`flex items-start gap-2 rounded-lg border p-2 text-[11px] ${notice.ok ? 'border-emerald-800 bg-emerald-950/30 text-emerald-300' : 'border-rose-800 bg-rose-950/30 text-rose-300'}`}>{notice.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}<span>{notice.text}</span></div>}
    <button type="button" onClick={save} disabled={saving} className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-500 px-3 py-2.5 text-xs font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}{saving ? 'در حال ثبت...' : 'ثبت تنظیمات کلاستر'}</button>
  </section>;
};
