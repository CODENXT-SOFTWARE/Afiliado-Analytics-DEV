"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import {
  Loader2, Trash2, AlertCircle, Search,
  Clock, PlusCircle, Info, Zap, Tag, RefreshCw,
  Play, Pause, Hash, Layers, X, ChevronLeft, ChevronRight, ChevronDown,
  List as ListIcon, User, Settings2, Smartphone, CheckCheck, Send, Pencil, Lock,
  ArrowLeftRight, ShoppingCart,
} from "lucide-react";
import BuscarGruposModal, {
  type BuscarGruposPayload,
  type EvolutionInstanceItem,
  type WhatsAppGroupItem,
} from "../gpl/BuscarGruposModal";
import MetaSearchablePicker from "@/app/components/meta/MetaSearchablePicker";
import { GeradorPaginationBar } from "@/app/components/shopee/GeradorPaginationBar";
import { janelaDuracaoMinutos, mensagemErroJanela, MAX_JANELA_MINUTOS } from "@/lib/grupos-venda-janela";
import { createClient as createBrowserSupabase } from "utils/supabase/client";
import { isGruposVendaMlOfferBlocked, MERCADOLIVRE_UX_COMING_SOON } from "@/lib/mercadolivre-ux-coming-soon";
import {
  isShoiaListName,
  SHOIA_LIST_LEADING_IMAGE_SRC,
  stripShoiaListNamePrefix,
} from "@/lib/shopee/shoia-list-label";
import ChannelTabs from "./ChannelTabs";
import { UpgradePlanNotice } from "@/app/components/plan/UpgradePlanNotice";
import { subscriptionToneForPlanTier } from "@/lib/plan-entitlements";
import { usePlanEntitlements } from "../PlanEntitlementsContext";

// ─── Types ─────────────────────────────────────────────────────────────────────
type ListaGrupos = { id: string; instanceId: string; nomeLista: string; createdAt: string };
type ContinuoItem = {
  id: string; listaId: string | null; listaNome: string;
  listaOfertasId: string | null; listaOfertasNome: string | null;
  listaOfertasMlId: string | null; listaOfertasMlNome: string | null;
  listaOfertasAmazonId: string | null; listaOfertasAmazonNome: string | null;
  listaOfertasInfoId: string | null; listaOfertasInfoNome: string | null;
  instanceId: string; keywords: string[]; subId1: string; subId2: string; subId3: string;
  ativo: boolean; proximoIndice: number; ultimoDisparoAt: string | null; updatedAt: string;
  proximaKeyword: string | null;
  horarioInicio: string | null; horarioFim: string | null;
};
type ListaOfertasItem = { id: string; nome: string; totalItens: number };
type Instance = EvolutionInstanceItem & { id: string };

// ─── Utils ──────────────────────────────────────────────────────────────────────
function cn(...classes: (string | false | undefined | null)[]): string { return classes.filter(Boolean).join(" "); }

/** Crossover: conta quantas fontes têm lista escolhida (só entra no rolê quem tem ID). */
function countCrossoverListas(opts: {
  shopeeId: string;
  mlId: string;
  amazonId: string;
  infoId: string;
  canMl: boolean;
  canAmazon: boolean;
  canInfo: boolean;
}) {
  return (
    (opts.shopeeId.trim() ? 1 : 0) +
    (opts.canMl && opts.mlId.trim() ? 1 : 0) +
    (opts.canAmazon && opts.amazonId.trim() ? 1 : 0) +
    (opts.canInfo && opts.infoId.trim() ? 1 : 0)
  );
}

function formatDuracaoJanela(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = Math.round(minutos % 60);
  if (h <= 0) return `${m} min`;
  return m > 0 ? `${h} h ${m} min` : `${h} h`;
}

// ─── Tooltip (portal) ──────────────────────────────────────────────────────────
function Tooltip({ text, children, wide }: { text: string; children?: React.ReactNode; wide?: boolean }) {
  const [visible, setVisible] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const anchorRef = useRef<HTMLSpanElement>(null);
  const show = useCallback(() => {
    const rect = anchorRef.current?.getBoundingClientRect();
    if (!rect) return;
    setCoords({ top: rect.top + window.scrollY - 8, left: rect.left + rect.width / 2 + window.scrollX });
    setVisible(true);
  }, []);
  const hide = useCallback(() => setVisible(false), []);
  const tooltip = visible ? createPortal(
    <span style={{ position: "absolute", top: coords.top, left: coords.left, transform: "translate(-50%, -100%)", zIndex: 99999 }}
      className={`pointer-events-none ${wide ? "w-72" : "w-56"} p-2.5 bg-[#111] border border-[#333] rounded-lg shadow-2xl text-xs text-[#bbb] leading-relaxed whitespace-normal block`}>
      {text}
      <span className="absolute left-1/2 -translate-x-1/2 top-full -mt-px border-4 border-transparent border-t-[#111]" />
    </span>, document.body
  ) : null;
  return (
    <span ref={anchorRef} className="relative inline-flex items-center" onMouseEnter={show} onMouseLeave={hide} onFocus={show} onBlur={hide}>
      {children ?? (
        <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-[#333]/80 text-[#888] hover:bg-shopee-orange/20 hover:text-shopee-orange transition-colors cursor-help">
          <Info className="h-2.5 w-2.5" />
        </span>
      )}
      {tooltip}
    </span>
  );
}

// ─── FieldLabel ─────────────────────────────────────────────────────────────────
function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest mb-1.5 light:text-zinc-500">
      {children}
    </label>
  );
}

// ─── WizardStepper ──────────────────────────────────────────────────────────────
const WIZARD_STEPS = [
  { id: 1, label: "Canal" },
  { id: 2, label: "Lista Alvo" },
  { id: 3, label: "Conteúdo" },
  { id: 4, label: "Ativar" },
];

function WizardStepper({ currentStep, onClose }: { currentStep: number; onClose: () => void }) {
  return (
    <div className="flex items-start gap-3 px-4 sm:px-6 pt-4 sm:pt-5 pb-3 sm:pb-4 border-b border-[#2c2c32]">
      <div className="flex-1 min-w-0">
        <div className="grid grid-cols-4 gap-2 sm:hidden">
          {WIZARD_STEPS.map((step) => {
            const isDone = currentStep > step.id;
            const isActive = currentStep === step.id;
            return (
              <div key={step.id} className="flex flex-col items-center gap-1 min-w-0">
                <div className={cn("w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold transition-all border-2 shrink-0",
                  isDone ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                    : isActive ? "bg-[#e24c30] border-[#e24c30] text-white shadow-lg shadow-[#e24c30]/30"
                    : "bg-[#222228] border-[#2c2c32] text-[#a0a0a0]")}>
                  {isDone ? <CheckCheck className="w-3 h-3" /> : step.id}
                </div>
                <p className={cn("text-[6px] font-bold uppercase tracking-[0.14em] text-center leading-tight whitespace-normal break-words max-w-full",
                  isActive ? "text-white" : isDone ? "text-emerald-400" : "text-[#a0a0a0]")}>
                  {step.label}
                </p>
              </div>
            );
          })}
        </div>
        <div className="hidden sm:flex items-center">
          {WIZARD_STEPS.map((step, index) => {
            const isDone = currentStep > step.id;
            const isActive = currentStep === step.id;
            const isLast = index === WIZARD_STEPS.length - 1;
            return (
              <div key={step.id} className="flex items-center flex-1 last:flex-none">
                <div className="flex flex-col items-center gap-1 shrink-0 min-w-[78px]">
                  <div className={cn("w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold transition-all border-2",
                    isDone ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400"
                      : isActive ? "bg-[#e24c30] border-[#e24c30] text-white shadow-lg shadow-[#e24c30]/30"
                      : "bg-[#222228] border-[#2c2c32] text-[#a0a0a0]")}>
                    {isDone ? <CheckCheck className="w-3.5 h-3.5" /> : step.id}
                  </div>
                  <p className={cn("text-[8px] font-bold uppercase tracking-widest whitespace-nowrap",
                    isActive ? "text-white" : isDone ? "text-emerald-400" : "text-[#a0a0a0]")}>
                    {step.label}
                  </p>
                </div>
                {!isLast && (
                  <div className={cn("flex-1 h-px mx-3 mb-4 transition-all", isDone ? "bg-emerald-500/35" : "bg-[#2c2c32]")} />
                )}
              </div>
            );
          })}
        </div>
      </div>
      <button onClick={onClose} title="Cancelar e voltar ao painel"
        className="text-[#a0a0a0] hover:text-white transition p-1.5 rounded-lg hover:bg-[#222228] shrink-0 mt-0.5">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── DisparoCard ────────────────────────────────────────────────────────────────
function DisparoCard({ c, togglingId, onToggle, onRemove, onEdit, onTestPulse, testPulseId }: {
  c: ContinuoItem; togglingId: string | null;
  onToggle: (id: string, ativar: boolean) => void;
  onRemove: (id: string) => void;
  onEdit?: () => void;
  onTestPulse?: (id: string) => void;
  testPulseId?: string | null;
}) {
  const isActive = c.ativo;
  const hasShopeeList = !!c.listaOfertasId;
  const hasMlList = !!c.listaOfertasMlId;
  const hasAmazonList = !!c.listaOfertasAmazonId;
  const hasInfoList = !!c.listaOfertasInfoId;
  const keywordsAsShopee =
    c.keywords.length > 0 && !hasShopeeList && !hasMlList && !hasAmazonList && !hasInfoList;
  const showShopeeLogo = hasShopeeList || keywordsAsShopee;
  const showMlLogo = hasMlList;
  const showAmazonLogo = hasAmazonList;
  const showInfoLogo = hasInfoList;
  const showPlatformLogos = showShopeeLogo || showMlLogo || showAmazonLogo || showInfoLogo;
  const activePlatforms = [
    showShopeeLogo && "Shopee",
    showMlLogo && "Mercado Livre",
    showAmazonLogo && "Amazon",
    showInfoLogo && "Infoprodutor",
  ].filter(Boolean) as string[];
  const platformTitle =
    activePlatforms.length > 1 ? activePlatforms.join(" + ") : activePlatforms[0] ?? "Shopee";
  return (
    <div className={cn("bg-[#1c1c1f] border rounded-xl p-3 sm:p-3.5 flex flex-col gap-2.5 transition-all min-w-0",
      isActive ? "border-emerald-500/20 shadow-sm shadow-emerald-500/5" : "border-[#2c2c32] hover:border-[#3e3e3e]")}>
      <div className="flex items-start justify-between gap-1.5 min-w-0">
        <h3 className="text-[10px] font-bold text-white uppercase tracking-wide leading-tight line-clamp-2 flex-1 min-w-0">{c.listaNome}</h3>
        {isActive ? (
          <span className="flex items-center gap-1 text-[8px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-full shrink-0">
            <div className="w-1 h-1 rounded-full bg-emerald-400 animate-pulse" /> Ativo
          </span>
        ) : (
          <span className="text-[8px] font-bold text-[#a0a0a0] bg-[#121214] border border-[#2c2c32] px-1.5 py-0.5 rounded-full shrink-0">Parado</span>
        )}
      </div>
      {showPlatformLogos && (
        <div className="flex items-center gap-1.5 flex-wrap" title={platformTitle}>
          {showShopeeLogo && (
            <Image
              src="/logoshopee.png"
              alt="Shopee"
              width={48}
              height={48}
              className="h-[18px] w-[18px] object-contain shrink-0"
            />
          )}
          {showShopeeLogo && showMlLogo && (
            <span className="text-[#5c5c5c] font-bold text-[9px]" aria-hidden>+</span>
          )}
          {showMlLogo && (
            <Image
              src="/ml.png"
              alt="Mercado Livre"
              width={48}
              height={22}
              className="h-[18px] w-auto max-w-[40px] object-contain"
            />
          )}
          {(showShopeeLogo || showMlLogo) && showAmazonLogo && (
            <span className="text-[#5c5c5c] font-bold text-[9px]" aria-hidden>+</span>
          )}
          {showAmazonLogo && (
            <Image
              src="/amazonlogo.webp"
              alt="Amazon"
              width={48}
              height={48}
              className="h-[18px] w-[18px] object-contain shrink-0"
            />
          )}
          {(showShopeeLogo || showMlLogo || showAmazonLogo) && showInfoLogo && (
            <span className="text-[#5c5c5c] font-bold text-[9px]" aria-hidden>+</span>
          )}
          {showInfoLogo && (
            <span
              className="inline-flex items-center justify-center rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-1 shrink-0 light:border-emerald-200/80 light:bg-emerald-100/90"
              title="Infoprodutor"
            >
              <ShoppingCart className="h-[14px] w-[14px] text-emerald-500 light:text-emerald-800" strokeWidth={2.25} aria-hidden />
              <span className="sr-only">Infoprodutor</span>
            </span>
          )}
        </div>
      )}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {c.keywords.length > 0 && (
          <div className="flex items-start gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Hash className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5" />
            <span className="line-clamp-2 break-words">{c.keywords.slice(0, 2).join(", ")}{c.keywords.length > 2 ? ` +${c.keywords.length - 2}` : ""}</span>
          </div>
        )}
        {c.listaOfertasNome && (
          <div className="flex items-start md:items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Layers className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5 md:mt-0" />
            <span className="min-w-0 max-md:break-words md:truncate">
              Lista Shopee:{" "}
              <span className="inline-flex items-center gap-1.5 text-white">
                {isShoiaListName(c.listaOfertasNome) ? (
                  <Image
                    src={SHOIA_LIST_LEADING_IMAGE_SRC}
                    alt=""
                    width={18}
                    height={18}
                    className="h-[18px] w-[18px] shrink-0 object-contain"
                  />
                ) : null}
                <span>{stripShoiaListNamePrefix(c.listaOfertasNome)}</span>
              </span>
            </span>
          </div>
        )}
        {c.listaOfertasMlNome && (
          <div className="flex items-start md:items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Layers className="w-2.5 h-2.5 text-amber-400 shrink-0 mt-0.5 md:mt-0" />
            <span className="min-w-0 max-md:break-words md:truncate">
              Lista ML: <span className="text-white">{c.listaOfertasMlNome}</span>
            </span>
          </div>
        )}
        {c.listaOfertasAmazonNome && (
          <div className="flex items-start md:items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Layers className="w-2.5 h-2.5 text-orange-400 shrink-0 mt-0.5 md:mt-0" />
            <span className="min-w-0 max-md:break-words md:truncate">
              Lista Amazon: <span className="text-white">{c.listaOfertasAmazonNome}</span>
            </span>
          </div>
        )}
        {c.listaOfertasInfoNome && (
          <div className="flex items-start md:items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Layers className="w-2.5 h-2.5 text-emerald-400 shrink-0 mt-0.5 md:mt-0" />
            <span className="min-w-0 max-md:break-words md:truncate">
              Lista Infoprodutor: <span className="text-white">{c.listaOfertasInfoNome}</span>
            </span>
          </div>
        )}
        {c.instanceId && (
          <div className="flex items-start md:items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <User className="w-2.5 h-2.5 text-[#e24c30] shrink-0 mt-0.5 md:mt-0" />
            <span className="min-w-0 max-md:break-all md:truncate">{c.instanceId}</span>
          </div>
        )}
        {c.horarioInicio && c.horarioFim && (
          <div className="flex items-center gap-1.5 text-[9px] min-w-0">
            <Clock className="w-2.5 h-2.5 text-emerald-400 shrink-0" />
            <span className="text-emerald-400 font-semibold break-words">{c.horarioInicio} – {c.horarioFim}</span>
          </div>
        )}
        {c.ultimoDisparoAt && (
          <div className="flex items-center gap-1.5 text-[9px] text-[#a0a0a0] min-w-0">
            <Clock className="w-2.5 h-2.5 shrink-0" />
            <span className="break-words">Próx: <span className="text-white font-semibold">{new Date(c.ultimoDisparoAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span></span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-1.5 pt-2 border-t border-[#2c2c32]">
        {isActive ? (
          <button type="button" onClick={() => onToggle(c.id, false)} disabled={togglingId === c.id}
            className="flex-1 flex items-center justify-center gap-1 text-[9px] font-bold text-red-400 border border-red-400/15 bg-red-400/5 py-1.5 rounded-lg hover:bg-red-400/15 disabled:opacity-40 transition">
            {togglingId === c.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Pause className="w-2.5 h-2.5 fill-red-400" />}
            Pausar
          </button>
        ) : (
          <div className="flex flex-1 items-center gap-1.5 min-w-0">
            <button type="button" onClick={() => onToggle(c.id, true)} disabled={togglingId === c.id}
              className="flex-1 min-w-0 flex items-center justify-center gap-1 text-[9px] font-bold text-emerald-400 border border-emerald-500/15 bg-emerald-500/5 py-1.5 rounded-lg hover:bg-emerald-500/15 disabled:opacity-40 transition">
              {togglingId === c.id ? <Loader2 className="w-2.5 h-2.5 animate-spin" /> : <Play className="w-2.5 h-2.5 fill-emerald-400" />}
              Ativar
            </button>
            {onTestPulse && (
              <button
                type="button"
                onClick={() => onTestPulse(c.id)}
                disabled={testPulseId === c.id || togglingId === c.id}
                title="Enviar próximo item da fila ao n8n (avança como o cron; não ativa a automação)"
                className="shrink-0 flex items-center justify-center p-1.5 rounded-lg border border-amber-400/30 bg-amber-400/8 text-amber-400 hover:bg-amber-400/15 disabled:opacity-40 transition"
                aria-label="Testar próximo envio ao n8n"
              >
                {testPulseId === c.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Zap className="w-3 h-3 fill-amber-400" strokeWidth={2} />
                )}
              </button>
            )}
          </div>
        )}
        {onEdit ? (
          <button
            type="button"
            onClick={onEdit}
            title="Editar lista de grupos, keywords, horário e listas de ofertas"
            aria-label="Editar automação"
            className="text-[#a0a0a0] hover:text-[#e24c30] transition bg-[#121214] border border-[#2c2c32] p-1.5 rounded-lg hover:border-[#e24c30]/25 shrink-0"
          >
            <Pencil className="w-3 h-3" />
          </button>
        ) : null}
        <button type="button" onClick={() => onRemove(c.id)}
          title="Excluir automação"
          className="text-[#a0a0a0] hover:text-red-400 transition bg-[#121214] border border-[#2c2c32] p-1.5 rounded-lg hover:border-red-400/20 shrink-0">
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Page
// ═══════════════════════════════════════════════════════════════════════════════
export default function GruposVendaPage() {
  // Entitlements: Inicial só vê Shopee como origem (sem ML/Amazon/Crossover/Infoprodutor).
  const { entitlements, tier, billingQuarterly } = usePlanEntitlements();
  const canUseMlSource = Boolean(entitlements?.mercadoLivre);
  const canUseAmazonSource = Boolean(entitlements?.amazon);
  const canUseInfoSource = Boolean(entitlements?.infoprodutor);

  const [instances, setInstances] = useState<Instance[]>([]);
  const [selectedInstanceId, setSelectedInstanceId] = useState("");
  const [listas, setListas] = useState<ListaGrupos[]>([]);
  const [loadingListas, setLoadingListas] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedListaId, setSelectedListaId] = useState("");
  const [keywords, setKeywords] = useState("");
  const [subId1, setSubId1] = useState("");
  const [subId2, setSubId2] = useState("");
  const [subId3, setSubId3] = useState("");
  const [disparando, setDisparando] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [continuoList, setContinuoList] = useState<ContinuoItem[]>([]);
  const [continuoLoading, setContinuoLoading] = useState(false);
  const [continuoTogglingId, setContinuoTogglingId] = useState<string | null>(null);
  const [deletingListaId, setDeletingListaId] = useState<string | null>(null);
  const [cronTestLoading, setCronTestLoading] = useState(false);
  const [cronTestFeedback, setCronTestFeedback] = useState<{ ok: boolean; message: string } | null>(null);
  const [testPulseId, setTestPulseId] = useState<string | null>(null);
  const [listasOfertas, setListasOfertas] = useState<ListaOfertasItem[]>([]);
  const [loadingListasOfertas, setLoadingListasOfertas] = useState(false);
  const [selectedListaOfertasId, setSelectedListaOfertasId] = useState("");
  const [listasOfertasMl, setListasOfertasMl] = useState<ListaOfertasItem[]>([]);
  const [loadingListasOfertasMl, setLoadingListasOfertasMl] = useState(false);
  const [selectedListaOfertasMlId, setSelectedListaOfertasMlId] = useState("");
  const [listasOfertasAmazon, setListasOfertasAmazon] = useState<ListaOfertasItem[]>([]);
  const [loadingListasOfertasAmazon, setLoadingListasOfertasAmazon] = useState(false);
  const [selectedListaOfertasAmazonId, setSelectedListaOfertasAmazonId] = useState("");
  const [listasOfertasInfo, setListasOfertasInfo] = useState<ListaOfertasItem[]>([]);
  const [loadingListasOfertasInfo, setLoadingListasOfertasInfo] = useState(false);
  const [selectedListaOfertasInfoId, setSelectedListaOfertasInfoId] = useState("");
  const [offerListSource, setOfferListSource] = useState<
    "shopee" | "ml" | "amazon" | "crossover" | "infoprodutor"
  >("shopee");

  // Crossover N-way: em `crossover`, o usuário escolhe listas por fonte; só as
  // listas selecionadas entram no rolê (mín. 2 fontes com lista).

  // Banner de upgrade ao clicar em uma origem bloqueada (cadeado).
  // Mantém o botão visível como gatilho de venda; click não troca a source.
  const [lockedSourcePrompt, setLockedSourcePrompt] = useState<null | "ml" | "amazon" | "info">(null);

  // Se o plano do usuário não permite a origem selecionada (ex.: downgrade Padrão→Inicial,
  // ou edição de campanha antiga em conta nova), força volta pra Shopee.
  useEffect(() => {
    if (!entitlements) return;
    if (!canUseMlSource) {
      setSelectedListaOfertasMlId("");
      if (offerListSource === "ml") setOfferListSource("shopee");
    }
    if (!canUseAmazonSource) {
      setSelectedListaOfertasAmazonId("");
      if (offerListSource === "amazon") setOfferListSource("shopee");
    }
    if (!canUseInfoSource) {
      setSelectedListaOfertasInfoId("");
      if (offerListSource === "infoprodutor") setOfferListSource("shopee");
    }
  }, [entitlements, offerListSource, canUseMlSource, canUseAmazonSource, canUseInfoSource]);

  const [horaInicio, setHoraInicio] = useState("");
  const [horaFim, setHoraFim] = useState("");

  // Wizard state
  const [view, setView] = useState<"panel" | "wizard">("panel");
  const [wizardStep, setWizardStep] = useState(1);
  const [showStepInfo, setShowStepInfo] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const [contentMode, setContentMode] = useState<"keywords" | "list">("keywords");
  const [panelSearch, setPanelSearch] = useState("");
  const [panelPage, setPanelPage] = useState(1);
  /** Step 3 mobile: bloco Sub IDs recolhido por padrão */
  const [mobileSubIdsOpen, setMobileSubIdsOpen] = useState(false);
  /** Step 4 mobile: resumo da automação recolhido por padrão */
  const [mobileResumoOpen, setMobileResumoOpen] = useState(false);
  /** Passo 2: avançar sem lista selecionada — modal de aviso */
  const [wizardListaAlvoAlertOpen, setWizardListaAlvoAlertOpen] = useState(false);
  /** Passo 3: modo keywords sem nenhuma keyword — modal de aviso */
  const [wizardKeywordsAlertOpen, setWizardKeywordsAlertOpen] = useState(false);
  /** Modal lista: edição (id + prefill carregado da API) */
  const [listaModalEdicaoId, setListaModalEdicaoId] = useState<string | null>(null);
  const [listaEditPrefill, setListaEditPrefill] = useState<{
    nomeLista: string;
    grupos: WhatsAppGroupItem[];
  } | null>(null);
  const [listaEditLoading, setListaEditLoading] = useState(false);
  /** Confirmar exclusão de lista alvo */
  const [listaDeleteConfirm, setListaDeleteConfirm] = useState<{ id: string; nome: string } | null>(null);
  /** Painel: 2 cards/página abaixo de lg; 6 no desktop (lg+, 1024px) */
  const [panelPerPage, setPanelPerPage] = useState(2);
  /** Painel: filtrar cards por status (evita confusão “Ativos” vs cards Parado) */
  const [panelStatusFilter, setPanelStatusFilter] = useState<"all" | "active" | "paused">("all");
  /** Edição de automação existente (wizard reutilizado + POST continuo com updateOnly) */
  const [editingContinuoId, setEditingContinuoId] = useState<string | null>(null);

  // ─── API ────────────────────────────────────────────────────────────────────
  const loadInstances = useCallback(async () => {
    try {
      const res = await fetch("/api/evolution/instances");
      const data = await res.json();
      const list = Array.isArray(data.instances) ? data.instances : [];
      const mapped = list.map((i: { id: string; nome_instancia: string; hash?: string | null }) => ({ id: i.id, nome_instancia: i.nome_instancia, hash: i.hash ?? null }));
      setInstances(mapped);
      if (mapped.length > 0 && !selectedInstanceId) setSelectedInstanceId(mapped[0].id);
    } catch { setInstances([]); }
  }, [selectedInstanceId]);

  const loadListas = useCallback(async () => {
    setLoadingListas(true);
    try {
      const url = selectedInstanceId ? `/api/grupos-venda/listas?instanceId=${encodeURIComponent(selectedInstanceId)}` : "/api/grupos-venda/listas";
      const res = await fetch(url);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar listas");
      setListas(Array.isArray(data.data) ? data.data : []);
    } catch (e) { setListas([]); setError(e instanceof Error ? e.message : "Erro"); }
    finally { setLoadingListas(false); }
  }, [selectedInstanceId]);

  const loadContinuo = useCallback(async () => {
    setContinuoLoading(true);
    try {
      const res = await fetch("/api/grupos-venda/continuo");
      const data = await res.json();
      if (res.ok) setContinuoList(Array.isArray(data.data) ? data.data : []);
    } catch { setContinuoList([]); }
    finally { setContinuoLoading(false); }
  }, []);

  const loadListasOfertas = useCallback(async () => {
    setLoadingListasOfertas(true);
    try {
      const res = await fetch("/api/shopee/minha-lista-ofertas/listas");
      const data = await res.json();
      if (res.ok) setListasOfertas(Array.isArray(data.data) ? data.data : []);
    } catch { setListasOfertas([]); }
    finally { setLoadingListasOfertas(false); }
  }, []);

  const loadListasOfertasMl = useCallback(async () => {
    setLoadingListasOfertasMl(true);
    try {
      const res = await fetch("/api/mercadolivre/minha-lista-ofertas/listas");
      const data = await res.json();
      if (res.ok) setListasOfertasMl(Array.isArray(data.data) ? data.data : []);
    } catch { setListasOfertasMl([]); }
    finally { setLoadingListasOfertasMl(false); }
  }, []);

  const loadListasOfertasInfo = useCallback(async () => {
    setLoadingListasOfertasInfo(true);
    try {
      const res = await fetch("/api/infoprodutor/minha-lista-ofertas/listas");
      const data = await res.json();
      if (res.ok) setListasOfertasInfo(Array.isArray(data.data) ? data.data : []);
    } catch { setListasOfertasInfo([]); }
    finally { setLoadingListasOfertasInfo(false); }
  }, []);

  const loadListasOfertasAmazon = useCallback(async () => {
    setLoadingListasOfertasAmazon(true);
    try {
      const res = await fetch("/api/amazon/minha-lista-ofertas/listas");
      const data = await res.json();
      if (res.ok) setListasOfertasAmazon(Array.isArray(data.data) ? data.data : []);
    } catch { setListasOfertasAmazon([]); }
    finally { setLoadingListasOfertasAmazon(false); }
  }, []);

  useEffect(() => { loadInstances(); }, [loadInstances]);
  useEffect(() => { loadListas(); }, [loadListas]);
  useEffect(() => { loadContinuo(); }, [loadContinuo]);
  useEffect(() => { loadListasOfertas(); }, [loadListasOfertas]);
  useEffect(() => { loadListasOfertasMl(); }, [loadListasOfertasMl]);
  useEffect(() => { loadListasOfertasAmazon(); }, [loadListasOfertasAmazon]);
  useEffect(() => { loadListasOfertasInfo(); }, [loadListasOfertasInfo]);

  const handleConfirmGroups = useCallback(async (payload: BuscarGruposPayload) => {
    const instance = instances.find((i) => i.nome_instancia === payload.nomeInstancia);
    if (!instance) { setError("Instância não encontrada."); return; }
    const nomeLista = payload.nomeLista?.trim();
    if (!nomeLista) { setError("Informe o nome da lista."); return; }
    const listaId = payload.listaId?.trim();
    const groupsBody = payload.grupos.map((g) => ({ id: g.id, nome: g.nome }));
    setSaving(true); setError(null);
    try {
      const res = await fetch("/api/grupos-venda/listas", {
        method: listaId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          listaId
            ? { id: listaId, nomeLista, groups: groupsBody }
            : { instanceId: instance.id, nomeLista, groups: groupsBody },
        ),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? (listaId ? "Erro ao atualizar lista" : "Erro ao criar lista"));
      const n = data.data?.groupsCount ?? payload.grupos.length;
      setFeedback(
        listaId
          ? `Lista "${data.data?.nomeLista ?? nomeLista}" atualizada (${n} grupo(s)).`
          : `Lista "${data.data?.nomeLista ?? nomeLista}" criada com ${n} grupo(s).`,
      );
      setTimeout(() => setFeedback(""), 5000);
      loadListas();
    } catch (e) {
      setError(e instanceof Error ? e.message : listaId ? "Erro ao atualizar lista" : "Erro ao criar lista");
    }
    finally { setSaving(false); }
    setModalOpen(false);
    setListaModalEdicaoId(null);
    setListaEditPrefill(null);
  }, [instances, loadListas]);

  const openModalCriarLista = useCallback(() => {
    setListaModalEdicaoId(null);
    setListaEditPrefill(null);
    setModalOpen(true);
  }, []);

  const openModalEditarLista = useCallback(async (list: ListaGrupos) => {
    setError(null);
    setListaEditLoading(true);
    setListaModalEdicaoId(null);
    setListaEditPrefill(null);
    try {
      const res = await fetch(`/api/grupos-venda/listas?id=${encodeURIComponent(list.id)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao carregar lista");
      const row = data.data as {
        nomeLista?: string;
        groups?: { id: string; nome: string; qtdMembros?: number }[];
      };
      const grupos: WhatsAppGroupItem[] = (row.groups ?? []).map((g) => ({
        id: g.id,
        nome: g.nome || "Grupo",
        qtdMembros: typeof g.qtdMembros === "number" ? g.qtdMembros : 0,
      }));
      setListaModalEdicaoId(list.id);
      setListaEditPrefill({ nomeLista: row.nomeLista ?? list.nomeLista, grupos });
      setModalOpen(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar lista");
    } finally {
      setListaEditLoading(false);
    }
  }, []);

  const handleDeleteLista = useCallback(async (id: string) => {
    setDeletingListaId(id);
    try {
      const res = await fetch(`/api/grupos-venda/listas?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data?.error === "string" ? data.error : "Erro ao remover");
      if (selectedListaId === id) setSelectedListaId("");
      loadListas();
      setContinuoList((prev) => prev.filter((c) => c.listaId !== id));
      setFeedback("Lista removida.");
      setTimeout(() => setFeedback(""), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao remover lista");
    } finally {
      setDeletingListaId(null);
      setListaDeleteConfirm(null);
    }
  }, [loadListas, selectedListaId]);

  const handleDisparar = useCallback(async () => {
    if (!selectedListaId) { setError("Selecione uma lista de grupos."); return; }
    const kwList = keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    const useListaShopee =
      contentMode === "list" &&
      !!selectedListaOfertasId.trim() &&
      (offerListSource === "shopee" || offerListSource === "crossover");
    const useListaMl =
      contentMode === "list" &&
      !!selectedListaOfertasMlId.trim() &&
      canUseMlSource &&
      (offerListSource === "ml" || offerListSource === "crossover");
    const useListaAmazon =
      contentMode === "list" &&
      !!selectedListaOfertasAmazonId.trim() &&
      canUseAmazonSource &&
      (offerListSource === "amazon" || offerListSource === "crossover");
    const useListaInfo =
      contentMode === "list" &&
      !!selectedListaOfertasInfoId.trim() &&
      canUseInfoSource &&
      (offerListSource === "infoprodutor" || offerListSource === "crossover");
    const useListaOfertas = useListaShopee || useListaMl || useListaAmazon || useListaInfo;
    if (contentMode === "list") {
      if (isGruposVendaMlOfferBlocked(offerListSource)) {
        setError("Mercado Livre e crossover estão em breve. Use a lista Shopee ou keywords.");
        return;
      }
      if (offerListSource === "shopee" && !selectedListaOfertasId) {
        setError("Selecione uma lista de ofertas Shopee.");
        return;
      }
      if (offerListSource === "ml" && !selectedListaOfertasMlId) {
        setError("Selecione uma lista de ofertas Mercado Livre.");
        return;
      }
      if (offerListSource === "amazon" && !selectedListaOfertasAmazonId) {
        setError("Selecione uma lista de ofertas Amazon.");
        return;
      }
      if (offerListSource === "crossover") {
        const activeCount = countCrossoverListas({
          shopeeId: selectedListaOfertasId,
          mlId: selectedListaOfertasMlId,
          amazonId: selectedListaOfertasAmazonId,
          infoId: selectedListaOfertasInfoId,
          canMl: canUseMlSource,
          canAmazon: canUseAmazonSource,
          canInfo: canUseInfoSource,
        });
        if (activeCount < 2) {
          setError("No crossover, selecione ao menos 2 listas em fontes diferentes.");
          return;
        }
      }
      if (offerListSource === "infoprodutor" && !selectedListaOfertasInfoId) {
        setError("Selecione uma lista do Infoprodutor.");
        return;
      }
    } else if (kwList.length === 0) {
      setError("Digite ao menos uma keyword.");
      return;
    }
    setDisparando(true); setError(null); setFeedback("");
    try {
      const res = await fetch("/api/grupos-venda/disparar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listaId: selectedListaId,
          keywords: useListaOfertas ? [] : kwList,
          listaOfertasId: useListaShopee ? selectedListaOfertasId : undefined,
          listaOfertasMlId: useListaMl ? selectedListaOfertasMlId : undefined,
          listaOfertasAmazonId: useListaAmazon ? selectedListaOfertasAmazonId : undefined,
          listaOfertasInfoId: useListaInfo ? selectedListaOfertasInfoId : undefined,
          subId1, subId2, subId3,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao disparar");
      const sent = data.sent ?? 0;
      const errList = data.errors ?? [];
      setFeedback(`${sent} oferta(s) enviada(s).${errList.length > 0 ? ` ${errList.length} erro(s).` : ""}`);
      setTimeout(() => setFeedback(""), 8000);
      if (errList.length > 0) setError(errList.map((e: { keyword: string; error: string }) => `${e.keyword}: ${e.error}`).join("; "));
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao disparar"); }
    finally { setDisparando(false); }
  }, [
    selectedListaId,
    contentMode,
    offerListSource,
    selectedListaOfertasId,
    selectedListaOfertasMlId,
    selectedListaOfertasAmazonId,
    selectedListaOfertasInfoId,
    canUseMlSource,
    canUseAmazonSource,
    canUseInfoSource,
    keywords,
    subId1,
    subId2,
    subId3,
  ]);

  const handleContinuoToggle = useCallback(async (configId: string, ativar: boolean) => {
    setError(null);
    if (ativar) {
      const c = continuoList.find((x) => x.id === configId);
      if (!c?.listaId) { setError("Config sem lista"); return; }
      if (!c.horarioInicio?.trim() || !c.horarioFim?.trim()) {
        setError("Esta automação não tem janela de horário. Exclua e crie outra com início e fim (máx. 14 h).");
        return;
      }
      const jErr = mensagemErroJanela(c.horarioInicio, c.horarioFim);
      if (jErr) { setError(jErr); return; }
    }
    setContinuoTogglingId(configId);
    try {
      if (!ativar) {
        const res = await fetch("/api/grupos-venda/continuo", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: configId, ativo: false }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro");
        setFeedback("Automação pausada.");
      } else {
        const c = continuoList.find((x) => x.id === configId);
        if (!c?.listaId) throw new Error("Config sem lista");
        const res = await fetch("/api/grupos-venda/continuo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: configId,
            listaId: c.listaId,
            listaOfertasId: c.listaOfertasId || undefined,
            listaOfertasMlId: c.listaOfertasMlId || undefined,
            listaOfertasAmazonId: c.listaOfertasAmazonId || undefined,
            listaOfertasInfoId: c.listaOfertasInfoId || undefined,
            keywords: c.keywords,
            subId1: c.subId1,
            subId2: c.subId2,
            subId3: c.subId3,
            horarioInicio: c.horarioInicio,
            horarioFim: c.horarioFim,
            ativo: true,
          }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error ?? "Erro ao ativar");
        setFeedback("Automação ativada.");
      }
      setTimeout(() => setFeedback(""), 4000);
      await loadContinuo();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); }
    finally { setContinuoTogglingId(null); }
  }, [continuoList, loadContinuo]);

  const handleAddContinuo = useCallback(async () => {
    if (!selectedListaId) { setError("Selecione uma lista de grupos."); return; }
    const editId = editingContinuoId;
    const isEditing = Boolean(editId);
    const useListaShopee =
      contentMode === "list" &&
      !!selectedListaOfertasId.trim() &&
      (offerListSource === "shopee" || offerListSource === "crossover");
    const useListaMl =
      contentMode === "list" &&
      !!selectedListaOfertasMlId.trim() &&
      canUseMlSource &&
      (offerListSource === "ml" || offerListSource === "crossover");
    const useListaAmazon =
      contentMode === "list" &&
      !!selectedListaOfertasAmazonId.trim() &&
      canUseAmazonSource &&
      (offerListSource === "amazon" || offerListSource === "crossover");
    const useListaInfo =
      contentMode === "list" &&
      !!selectedListaOfertasInfoId.trim() &&
      canUseInfoSource &&
      (offerListSource === "infoprodutor" || offerListSource === "crossover");
    const useListaOfertas = useListaShopee || useListaMl || useListaAmazon || useListaInfo;
    const kwList = keywords.split(/[\n,;]+/).map((s) => s.trim()).filter(Boolean);
    if (!useListaOfertas && kwList.length === 0) { setError("Digite ao menos uma keyword ou selecione uma lista de ofertas."); return; }
    if (contentMode === "list" && isGruposVendaMlOfferBlocked(offerListSource)) {
      setError("Mercado Livre e crossover estão em breve. Use a lista Shopee ou keywords.");
      return;
    }
    if (contentMode === "list" && offerListSource === "crossover") {
      const activeCount = countCrossoverListas({
        shopeeId: selectedListaOfertasId,
        mlId: selectedListaOfertasMlId,
        amazonId: selectedListaOfertasAmazonId,
        infoId: selectedListaOfertasInfoId,
        canMl: canUseMlSource,
        canAmazon: canUseAmazonSource,
        canInfo: canUseInfoSource,
      });
      if (activeCount < 2) {
        setError("No crossover, selecione ao menos 2 listas em fontes diferentes.");
        return;
      }
    }
    if (contentMode === "list" && offerListSource === "infoprodutor" && !selectedListaOfertasInfoId) {
      setError("Selecione uma lista do Infoprodutor.");
      return;
    }
    if (contentMode === "list" && offerListSource === "amazon" && !selectedListaOfertasAmazonId) {
      setError("Selecione uma lista de ofertas Amazon.");
      return;
    }
    const jErr = mensagemErroJanela(horaInicio, horaFim);
    if (jErr) { setError(jErr); return; }
    setContinuoTogglingId(isEditing && editId ? editId : "new"); setError(null);
    try {
      const res = await fetch("/api/grupos-venda/continuo", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(isEditing && editId
            ? { id: editId, updateOnly: true, ativo: false }
            : {}),
          listaId: selectedListaId,
          listaOfertasId: useListaShopee ? selectedListaOfertasId : undefined,
          listaOfertasMlId: useListaMl ? selectedListaOfertasMlId : undefined,
          listaOfertasAmazonId: useListaAmazon ? selectedListaOfertasAmazonId : undefined,
          listaOfertasInfoId: useListaInfo ? selectedListaOfertasInfoId : undefined,
          keywords: useListaOfertas ? [] : kwList,
          subId1, subId2, subId3, horarioInicio: horaInicio.trim(), horarioFim: horaFim.trim(),
          ...(!isEditing ? { ativo: true } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro");
      const horarioMsg = ` Janela ${horaInicio} – ${horaFim}.`;
      const listaMsg =
        isEditing
          ? "Automação atualizada."
          : offerListSource === "crossover" && useListaOfertas
            ? "Automação crossover (Shopee + ML) criada."
            : useListaInfo
              ? "Automação por lista do Infoprodutor criada."
              : useListaOfertas
                ? "Automação por lista de ofertas criada."
                : "Automação criada.";
      setFeedback(isEditing ? listaMsg : `${listaMsg}${horarioMsg}`);
      setTimeout(() => setFeedback(""), 5000);
      setEditingContinuoId(null);
      setSelectedListaId(""); setKeywords(""); setSelectedListaOfertasId(""); setSelectedListaOfertasMlId(""); setSelectedListaOfertasAmazonId(""); setSelectedListaOfertasInfoId(""); setSubId1(""); setSubId2(""); setSubId3(""); setHoraInicio(""); setHoraFim("");
      setView("panel");
      await loadContinuo();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao criar automação"); }
    finally { setContinuoTogglingId(null); }
  }, [
    editingContinuoId,
    selectedListaId,
    contentMode,
    offerListSource,
    selectedListaOfertasId,
    selectedListaOfertasMlId,
    selectedListaOfertasAmazonId,
    selectedListaOfertasInfoId,
    canUseMlSource,
    canUseAmazonSource,
    canUseInfoSource,
    keywords,
    subId1,
    subId2,
    subId3,
    horaInicio,
    horaFim,
    loadContinuo,
  ]);

  const handleRemoveContinuo = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/grupos-venda/continuo?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Erro ao remover");
      loadContinuo();
    } catch { setError("Erro ao remover disparo"); }
  }, [loadContinuo]);

  const postCronTest = useCallback(
    async (body: Record<string, string>) => {
      const supabase = createBrowserSupabase();
      const { data: { session } } = await supabase.auth.getSession();
      const headers: HeadersInit = { "Content-Type": "application/json" };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
      return fetch("/api/grupos-venda/cron-disparo", {
        method: "POST",
        credentials: "include",
        headers,
        body: JSON.stringify(body),
      });
    },
    [],
  );

  const handleTestCron = useCallback(async () => {
    setCronTestLoading(true);
    setCronTestFeedback(null);
    setError(null);
    try {
      const res = await postCronTest({});
      const data = (await res.json().catch(() => ({}))) as {
        results?: { keyword?: string; ok?: boolean; error?: string }[];
        processed?: number;
        message?: string;
        error?: string;
      };

      type CronRow = { keyword?: string; ok?: boolean; error?: string };
      const results = (data.results ?? []) as CronRow[];
      const processed = typeof data.processed === "number" ? data.processed : 0;
      const enviados = results.filter((r) => r.ok && !r.error).length;
      const ignorados = results.filter((r) => r.ok && !!r.error).length;
      const falhas = results.filter((r) => !r.ok).length;
      const msg = typeof data.message === "string" ? data.message : "";

      if (!res.ok) {
        setCronTestFeedback({
          ok: false,
          message: data.error ?? `Erro HTTP ${res.status}. Confira se está logado.`,
        });
        return;
      }

      if (processed === 0 && results.length === 0) {
        const benign = /Nenhum disparo ativo/i.test(msg);
        setCronTestFeedback({ ok: benign, message: msg || "Nenhuma automação ativa para testar." });
        return;
      }

      if (falhas > 0) {
        const failLines = results
          .filter((r) => !r.ok)
          .map((r) => r.error || r.keyword || "falha")
          .slice(0, 4);
        setCronTestFeedback({
          ok: false,
          message: `${falhas} falha(s): ${failLines.join(" · ")}`,
        });
      } else if (enviados > 0) {
        setCronTestFeedback({
          ok: true,
          message: `${enviados} teste(s) enviado(s) ao n8n.`,
        });
        loadContinuo();
      } else {
        setCronTestFeedback({
          ok: true,
          message:
            ignorados > 0
              ? results.map((r) => r.error).filter(Boolean).slice(0, 3).join(" · ") || "Nenhum envio neste teste."
              : "Teste concluído.",
        });
      }
    } catch (e) {
      setCronTestFeedback({
        ok: false,
        message: e instanceof Error ? e.message : "Falha de rede ao testar.",
      });
    } finally {
      setCronTestLoading(false);
    }
  }, [loadContinuo, postCronTest]);

  const handleTestPulse = useCallback(
    async (configId: string) => {
      setTestPulseId(configId);
      setError(null);
      setCronTestFeedback(null);
      try {
        const res = await postCronTest({ configId });
        const data = (await res.json().catch(() => ({}))) as {
          results?: { keyword?: string; ok?: boolean; error?: string }[];
          processed?: number;
          message?: string;
          error?: string;
        };
        const results = data.results ?? [];
        if (!res.ok) {
          setError(data.error ?? `Erro HTTP ${res.status}`);
          return;
        }
        if (data.processed === 0 && results.length === 0) {
          setError(data.message || "Automação não encontrada.");
          return;
        }
        const fail = results.find((r) => !r.ok);
        if (fail) {
          setError(fail.error ?? "Falha ao enviar teste ao n8n.");
          return;
        }
        const okRow = results.find((r) => r.ok && !r.error);
        await loadContinuo();
        setFeedback(okRow?.keyword ? `Teste enviado: ${okRow.keyword}` : "Teste enviado ao n8n.");
        setTimeout(() => setFeedback(""), 5000);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao testar");
      } finally {
        setTestPulseId(null);
      }
    },
    [postCronTest, loadContinuo],
  );

  const activeCount = continuoList.filter((c) => c.ativo).length;
  /** Mesma regra de parsing que o envio/API: linhas ou separadores vírgula/ponto-e-vírgula */
  const keywordCount = keywords
    .split(/[\n,;]+/)
    .map((k) => k.trim())
    .filter(Boolean).length;
  /** Passo 3: Sub IDs ocultos para lista ML / crossover / infoprodutor (por ora). */
  const showSubIdsRastreamentoStep3 =
    contentMode === "keywords" || (contentMode === "list" && offerListSource === "shopee");
  const janelaPreviewText = useMemo(() => {
    if (!horaInicio?.trim() || !horaFim?.trim()) return null;
    const msg = mensagemErroJanela(horaInicio, horaFim);
    if (msg) return { variant: "error" as const, text: msg };
    const d = janelaDuracaoMinutos(horaInicio, horaFim);
    if (d === null) return { variant: "error" as const, text: "Horários inválidos." };
    return {
      variant: "ok" as const,
      text: `Duração: ${formatDuracaoJanela(d)} · limite: ${formatDuracaoJanela(MAX_JANELA_MINUTOS)}`,
    };
  }, [horaInicio, horaFim]);
  /** Passo 4: só libera “Ativar automação” com janela válida (≤ 14 h, início ≠ fim). */
  const erroJanelaAtivar = useMemo(() => mensagemErroJanela(horaInicio, horaFim), [horaInicio, horaFim]);
  const podeAtivarAutomacao = erroJanelaAtivar === null;
  const selectedList = listas.find((l) => l.id === selectedListaId);
  const filteredLists = listas.filter((l) => l.nomeLista.toLowerCase().includes(listSearch.toLowerCase()));
  const filteredDisparos = continuoList
    .filter((d) => {
      if (panelStatusFilter === "active" && !d.ativo) return false;
      if (panelStatusFilter === "paused" && d.ativo) return false;
      return true;
    })
    .filter(
      (d) =>
        d.listaNome.toLowerCase().includes(panelSearch.toLowerCase()) ||
        d.instanceId?.toLowerCase().includes(panelSearch.toLowerCase()),
    );

  const panelTotalPages = Math.max(1, Math.ceil(filteredDisparos.length / panelPerPage));
  const safePanelPage = Math.min(panelPage, panelTotalPages);
  const pagedDisparos = filteredDisparos.slice(
    (safePanelPage - 1) * panelPerPage,
    safePanelPage * panelPerPage,
  );

  useEffect(() => {
    setPanelPage(1);
  }, [panelSearch, panelStatusFilter]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const apply = () => setPanelPerPage(mq.matches ? 6 : 2);
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    setPanelPage((p) => Math.min(p, panelTotalPages));
  }, [panelTotalPages, panelPerPage]);

  useEffect(() => {
    if (wizardStep !== 3) setMobileSubIdsOpen(false);
  }, [wizardStep]);

  useEffect(() => {
    if (wizardStep !== 4) setMobileResumoOpen(false);
  }, [wizardStep]);

  useEffect(() => {
    if (!wizardListaAlvoAlertOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWizardListaAlvoAlertOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wizardListaAlvoAlertOpen]);

  useEffect(() => {
    if (!wizardKeywordsAlertOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWizardKeywordsAlertOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [wizardKeywordsAlertOpen]);

  const subIdsFilledCount = [subId1, subId2, subId3].filter((s) => s.trim()).length;
  const subIdsMobileSummary =
    subIdsFilledCount === 0
      ? "Opcional — toque para configurar"
      : subIdsFilledCount === 3
        ? "Canal, lista e campanha preenchidos"
        : `${subIdsFilledCount} campo${subIdsFilledCount > 1 ? "s" : ""} preenchido${subIdsFilledCount > 1 ? "s" : ""}`;

  const listaOfertasPickerOptions = useMemo(
    () => [
      {
        value: "",
        label: "Sem lista de ofertas (usa keywords)",
        description: "Envio por keywords em vez de produtos fixos",
      },
      ...listasOfertas.map((l) => ({
        value: l.id,
        label: stripShoiaListNamePrefix(l.nome),
        description: `${l.totalItens} ${l.totalItens === 1 ? "item" : "itens"}`,
        ...(isShoiaListName(l.nome)
          ? { leadingImageSrc: SHOIA_LIST_LEADING_IMAGE_SRC, leadingImageAlt: "" }
          : {}),
      })),
    ],
    [listasOfertas],
  );

  const listaOfertasMlPickerOptions = useMemo(
    () => [
      {
        value: "",
        label: "Selecione uma lista ML",
        description: "Crie em Lista de Ofertas - ML",
      },
      ...listasOfertasMl.map((l) => ({
        value: l.id,
        label: l.nome,
        description: `${l.totalItens} ${l.totalItens === 1 ? "item" : "itens"}`,
      })),
    ],
    [listasOfertasMl],
  );

  const listaOfertasInfoPickerOptions = useMemo(
    () => [
      {
        value: "",
        label: "Selecione uma lista Infoprodutor",
        description: "Crie em Infoprodutor",
      },
      ...listasOfertasInfo.map((l) => ({
        value: l.id,
        label: l.nome,
        description: `${l.totalItens} ${l.totalItens === 1 ? "item" : "itens"}`,
      })),
    ],
    [listasOfertasInfo],
  );

  const listaOfertasAmazonPickerOptions = useMemo(
    () => [
      {
        value: "",
        label: "Selecione uma lista Amazon",
        description: "Crie em Lista de Ofertas - Amazon",
      },
      ...listasOfertasAmazon.map((l) => ({
        value: l.id,
        label: l.nome,
        description: `${l.totalItens} ${l.totalItens === 1 ? "item" : "itens"}`,
      })),
    ],
    [listasOfertasAmazon],
  );

  function openWizard() {
    setEditingContinuoId(null);
    setWizardStep(1);
    setShowStepInfo(false);
    setWizardListaAlvoAlertOpen(false);
    setWizardKeywordsAlertOpen(false);
    setView("wizard");
  }

  function openWizardForEdit(c: ContinuoItem) {
    setEditingContinuoId(c.id);
    setWizardStep(1);
    setShowStepInfo(false);
    setWizardListaAlvoAlertOpen(false);
    setWizardKeywordsAlertOpen(false);
    setError(null);
    setSelectedInstanceId(c.instanceId || "");
    setSelectedListaId(c.listaId || "");
    setSubId1(c.subId1 ?? "");
    setSubId2(c.subId2 ?? "");
    setSubId3(c.subId3 ?? "");
    setHoraInicio((c.horarioInicio ?? "").trim());
    setHoraFim((c.horarioFim ?? "").trim());

    const amazonOid = c.listaOfertasAmazonId ?? "";
    const listSourcesCount =
      (c.listaOfertasId ? 1 : 0) +
      (c.listaOfertasMlId ? 1 : 0) +
      (amazonOid ? 1 : 0) +
      (c.listaOfertasInfoId ? 1 : 0);

    if (listSourcesCount >= 2) {
      setContentMode("list");
      setOfferListSource("crossover");
      setSelectedListaOfertasId(c.listaOfertasId || "");
      setSelectedListaOfertasMlId(c.listaOfertasMlId || "");
      setSelectedListaOfertasAmazonId(amazonOid);
      setSelectedListaOfertasInfoId(c.listaOfertasInfoId || "");
      setKeywords("");
    } else if (c.listaOfertasInfoId) {
      setContentMode("list");
      setOfferListSource("infoprodutor");
      setSelectedListaOfertasInfoId(c.listaOfertasInfoId);
      setSelectedListaOfertasId("");
      setSelectedListaOfertasMlId("");
      setSelectedListaOfertasAmazonId("");
      setKeywords("");
    } else if (c.listaOfertasMlId) {
      setContentMode("list");
      setOfferListSource("ml");
      setSelectedListaOfertasMlId(c.listaOfertasMlId);
      setSelectedListaOfertasId("");
      setSelectedListaOfertasAmazonId("");
      setSelectedListaOfertasInfoId("");
      setKeywords("");
    } else if (amazonOid) {
      setContentMode("list");
      setOfferListSource("amazon");
      setSelectedListaOfertasAmazonId(amazonOid);
      setSelectedListaOfertasId("");
      setSelectedListaOfertasMlId("");
      setSelectedListaOfertasInfoId("");
      setKeywords("");
    } else if (c.listaOfertasId) {
      setContentMode("list");
      setOfferListSource("shopee");
      setSelectedListaOfertasId(c.listaOfertasId);
      setSelectedListaOfertasMlId("");
      setSelectedListaOfertasAmazonId("");
      setSelectedListaOfertasInfoId("");
      setKeywords("");
    } else {
      setContentMode("keywords");
      setOfferListSource("shopee");
      setKeywords((c.keywords ?? []).join("\n"));
      setSelectedListaOfertasId("");
      setSelectedListaOfertasMlId("");
      setSelectedListaOfertasAmazonId("");
      setSelectedListaOfertasInfoId("");
    }

    setView("wizard");
  }

  function closeWizard() {
    setShowStepInfo(false);
    setWizardListaAlvoAlertOpen(false);
    setWizardKeywordsAlertOpen(false);
    setModalOpen(false);
    setListaModalEdicaoId(null);
    setListaEditPrefill(null);
    setEditingContinuoId(null);
    setView("panel");
  }
  function handleNext() {
    setShowStepInfo(false);
    if (wizardStep === 2 && !selectedListaId.trim()) {
      setWizardListaAlvoAlertOpen(true);
      return;
    }
    if (wizardStep === 3) {
      if (contentMode === "keywords") {
        const kwLines = keywords
          .split(/[\n,;]+/)
          .map((s) => s.trim())
          .filter(Boolean);
        if (kwLines.length === 0) {
          setWizardKeywordsAlertOpen(true);
          return;
        }
        setError(null);
      } else if (contentMode === "list") {
        if (isGruposVendaMlOfferBlocked(offerListSource)) {
          setError("Mercado Livre e crossover estão em breve. Use a lista Shopee ou keywords.");
          return;
        }
        if (offerListSource === "shopee" && !selectedListaOfertasId) {
          setError("Selecione uma lista de ofertas Shopee.");
          return;
        }
        if (offerListSource === "ml" && !selectedListaOfertasMlId) {
          setError("Selecione uma lista de ofertas Mercado Livre.");
          return;
        }
        if (offerListSource === "crossover") {
          const n = countCrossoverListas({
            shopeeId: selectedListaOfertasId,
            mlId: selectedListaOfertasMlId,
            amazonId: selectedListaOfertasAmazonId,
            infoId: selectedListaOfertasInfoId,
            canMl: canUseMlSource,
            canAmazon: canUseAmazonSource,
            canInfo: canUseInfoSource,
          });
          if (n < 2) {
            setError("No crossover, selecione ao menos 2 listas em fontes diferentes.");
            return;
          }
        }
        if (offerListSource === "infoprodutor" && !selectedListaOfertasInfoId) {
          setError("Selecione uma lista do Infoprodutor.");
          return;
        }
        setError(null);
      }
    }
    if (wizardStep < 4) setWizardStep((s) => s + 1);
  }
  function handleBack() { setShowStepInfo(false); if (wizardStep > 1) setWizardStep((s) => s - 1); }
  function handleFinish() {
    if (wizardStep === 4) {
      const jErr = mensagemErroJanela(horaInicio, horaFim);
      if (jErr) {
        setError(jErr);
        return;
      }
      void handleAddContinuo();
      return;
    }
    closeWizard();
  }

  const stepMeta: Record<number, { title: string; description: ReactNode }> = {
    1: { title: "Selecionar Canal WhatsApp", description: "Selecione o número do WhatsApp que será usado para disparar mensagens nos grupos. Apenas instâncias conectadas estão disponíveis." },
    2: { title: "Definir Lista de Grupos Alvo", description: (<>Selecione uma lista já salva ou crie uma nova buscando os grupos da instância <span className="text-white font-semibold">{instances.find((i) => i.id === selectedInstanceId)?.nome_instancia ?? selectedInstanceId}</span>.</>) },
    3: { title: "Configurar Conteúdo e Rastreamento", description: "Defina o que será enviado nos grupos e configure os Sub IDs para rastreamento de vendas por canal." },
    4: { title: "Definir Horário e Ativar Disparo", description: "Defina a janela diária (máximo 14 horas seguidas). A automação aparece no Painel de Controle e só dispara dentro desse horário." },
  };

  return (
    <div className="flex flex-col w-full text-[#f0f0f2]  rounded-lg p-3 sm:p-6 gap-4 sm:gap-5">
      <style jsx>{`
        .scrollbar-thin::-webkit-scrollbar { width: 4px; height: 4px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background: #3e3e3e; border-radius: 10px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background: #e24c30; }
      `}</style>

      <ChannelTabs />

      {/* Header */}
      <header>
        <h1 className="text-lg sm:text-xl font-bold flex items-center gap-2.5 text-white">
          <Image src="/whatsapp.png" alt="WhatsApp" width={32} height={32} className="w-7 h-7 object-contain shrink-0" />
          Grupos de Venda
        </h1>
        <p className="text-[11px] text-[#a0a0a0] mt-1 leading-relaxed max-md:hidden">
          Dispare ofertas automaticamente em grupos do WhatsApp dentro de uma janela de até 14 horas por dia.
        </p>
      </header>

      {/* Feedback / Error */}
      {feedback && (
        <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 flex items-center gap-2">
          <CheckCheck className="h-4 w-4 text-emerald-400 shrink-0" />
          <p className="text-sm text-emerald-400">{feedback}</p>
        </div>
      )}
      {error && (
        <div className="p-3 rounded-xl border border-red-500/40 bg-red-500/10 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button type="button" onClick={() => setError(null)} className="ml-auto text-red-400/60 hover:text-red-400 text-xs shrink-0">✕</button>
        </div>
      )}

      {/* Panel view */}
      {view === "panel" && (
        <>
          {/* Criar Nova Automação */}
          <button onClick={openWizard}
            className="w-full flex items-center justify-between bg-[#27272a] border border-[#2c2c32] hover:border-[#e24c30]/40 rounded-xl px-4 sm:px-5 py-3.5 sm:py-4 transition-all group gap-3 text-left">
            <div className="flex items-start sm:items-center gap-3 min-w-0 flex-1 max-md:items-center">
              <div className="w-10 h-10 sm:w-9 sm:h-9 rounded-xl bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/20 group-hover:shadow-lg group-hover:shadow-[#e24c30]/15 transition-all">
                <PlusCircle className="w-4 h-4 text-[#e24c30]" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[11px] sm:text-[12px] font-bold text-white leading-tight">Criar Nova Automação</p>
                <p className="text-[9px] sm:text-[10px] text-[#a0a0a0] mt-1 leading-relaxed line-clamp-2 sm:line-clamp-none max-md:hidden">Configure instância, lista de grupos, conteúdo e horário passo a passo.</p>
              </div>
            </div>
            <div className="w-8 h-8 rounded-lg bg-[#222228] border border-[#2c2c32] flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/10 group-hover:border-[#e24c30]/25 transition-all">
              <ChevronRight className="w-4 h-4 text-[#a0a0a0] group-hover:text-[#e24c30] transition-colors" />
            </div>
          </button>

          {/* Painel de Controle */}
          <section className="bg-[#27272a] border border-[#2c2c32] rounded-xl overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 border-b border-[#2c2c32]">
              <div className="flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-[10px] font-bold text-white uppercase tracking-widest flex items-center gap-2">
                    <Settings2 className="w-3.5 h-3.5 text-[#e24c30]" /> Painel de Controle
                  </h2>
                  <span className="text-[9px] font-bold text-[#a0a0a0] bg-[#222228] border border-[#2c2c32] px-2 py-0.5 rounded-md">{continuoList.length} disparos</span>
                  <span className="text-[9px] font-bold text-emerald-400 bg-emerald-500/10 border border-emerald-500/15 px-2 py-0.5 rounded-full">{activeCount} ativos</span>
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtrar por status">
                    {(
                      [
                        { id: "all" as const, label: "Todos" },
                        { id: "active" as const, label: "Ativos" },
                        { id: "paused" as const, label: "Parados" },
                      ] as const
                    ).map(({ id, label }) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setPanelStatusFilter(id)}
                        className={cn(
                          "text-[9px] font-bold px-2.5 py-1 rounded-full border transition",
                          panelStatusFilter === id
                            ? id === "active"
                              ? "bg-emerald-500/15 border-emerald-500/35 text-emerald-400"
                              : id === "paused"
                                ? "bg-[#2c2c32] border-[#3e3e3e] text-[#d0d0d0]"
                                : "bg-[#e24c30]/15 border-[#e24c30]/35 text-[#e24c30]"
                            : "bg-transparent border-[#2c2c32] text-[#a0a0a0] hover:text-white hover:border-[#3e3e3e]",
                        )}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3 h-3 text-[#a0a0a0] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="text" value={panelSearch} onChange={(e) => setPanelSearch(e.target.value)} placeholder="Buscar disparo..."
                      className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg pl-7 pr-7 py-2 sm:py-1.5 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition" />
                    {panelSearch && (
                      <button onClick={() => setPanelSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white transition">
                        <X className="w-2.5 h-2.5" />
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={handleTestCron} disabled={cronTestLoading}
                      className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 text-amber-400 border border-amber-400/25 bg-amber-400/5 px-3 py-2 sm:py-1.5 rounded-lg text-[9px] font-bold hover:bg-amber-400/10 disabled:opacity-40 transition">
                      {cronTestLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 fill-amber-400" />}
                      <span className="sm:hidden">Testar</span><span className="hidden sm:inline">Testar agora</span>
                    </button>
                    <button onClick={loadContinuo} disabled={continuoLoading}
                      className="text-[#a0a0a0] hover:text-white transition p-2 sm:p-1.5 rounded-lg hover:bg-[#222228] shrink-0 disabled:opacity-40">
                      <RefreshCw className={cn("w-3.5 h-3.5", continuoLoading && "animate-spin")} />
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {cronTestFeedback && (
              <div
                className={cn(
                  "mx-4 mt-3 p-3 rounded-xl border text-xs font-semibold leading-relaxed",
                  cronTestFeedback.ok
                    ? "bg-emerald-500/8 border-emerald-500/35 text-emerald-300"
                    : "bg-red-500/8 border-red-500/35 text-red-300",
                )}
              >
                {cronTestFeedback.message}
              </div>
            )}

            <div className="p-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 min-h-[120px]">
                {continuoLoading ? (
                  <div className="col-span-full flex items-center justify-center gap-2 py-10 text-[#a0a0a0] text-sm">
                    <Loader2 className="w-4 h-4 animate-spin" /> Carregando...
                  </div>
                ) : filteredDisparos.length > 0 ? (
                  pagedDisparos.map((item) => (
                    <DisparoCard
                      key={item.id}
                      c={item}
                      togglingId={continuoTogglingId}
                      onToggle={handleContinuoToggle}
                      onRemove={handleRemoveContinuo}
                      onEdit={() => openWizardForEdit(item)}
                      onTestPulse={handleTestPulse}
                      testPulseId={testPulseId}
                    />
                  ))
                ) : (
                  <div className="col-span-full flex flex-col items-center justify-center gap-2 py-10 text-center">
                    <Search className="w-7 h-7 text-[#2c2c32]" />
                    <p className="text-[11px] font-semibold text-[#a0a0a0]">
                      {continuoList.length === 0 ? "Nenhum disparo configurado" : "Nenhum disparo encontrado"}
                    </p>
                    <p className="text-[9px] text-[#a0a0a0]/60">
                      {continuoList.length === 0 ? "Clique em \"Criar Nova Automação\" para começar." : "Tente outro título ou instância."}
                    </p>
                  </div>
                )}
              </div>

              {!continuoLoading && filteredDisparos.length > 0 && (
                <nav className="mt-4 pt-4 pb-1 border-t border-[#2c2c32] lg:mt-3 lg:pt-3 px-2 sm:px-4" aria-label="Paginação do painel">
                  <GeradorPaginationBar
                    page={safePanelPage}
                    totalPages={panelTotalPages}
                    summary={`Mostrando ${(safePanelPage - 1) * panelPerPage + 1}–${Math.min(safePanelPage * panelPerPage, filteredDisparos.length)} de ${filteredDisparos.length} disparo${filteredDisparos.length !== 1 ? "s" : ""}`}
                    onPrev={() => setPanelPage((p) => Math.max(1, p - 1))}
                    onNext={() => setPanelPage((p) => Math.min(panelTotalPages, p + 1))}
                  />
                </nav>
              )}
            </div>
          </section>
        </>
      )}

      {/* Wizard view */}
      {view === "wizard" && (
        <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl sm:rounded-2xl overflow-hidden flex flex-col min-w-0">
          <WizardStepper currentStep={wizardStep} onClose={closeWizard} />

          <div className="px-4 sm:px-6 py-4 border-b border-[#2c2c32]">
            <div className="flex items-start justify-between gap-3">
              <h2 className="text-sm font-bold text-white leading-snug">{stepMeta[wizardStep].title}</h2>
              <button type="button" onClick={() => setShowStepInfo((v) => !v)}
                className="sm:hidden w-7 h-7 rounded-full border border-[#2c2c32] bg-[#222228] text-[#a0a0a0] hover:text-white hover:border-[#3e3e3e] transition shrink-0">
                ⓘ
              </button>
            </div>
            <p className="hidden sm:block text-[11px] text-[#a0a0a0] leading-relaxed mt-1">{stepMeta[wizardStep].description}</p>
            {showStepInfo && (
              <div className="sm:hidden mt-3 rounded-xl border border-[#2c2c32] bg-[#1c1c1f] px-3 py-2.5 text-[10px] text-[#a0a0a0] leading-relaxed">
                {stepMeta[wizardStep].description}
              </div>
            )}
          </div>

          <div className="flex-1 p-4 sm:p-6 min-w-0">
            {/* Step 1: Selecionar instância */}
            {wizardStep === 1 && (
              <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-4 sm:gap-6">
                <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-4 flex flex-col gap-2 h-fit max-md:hidden">
                  <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">💡 Sobre Instâncias</p>
                  <p className="text-[10px] text-[#a0a0a0] leading-relaxed">Cada instância representa um número de WhatsApp conectado à plataforma. Múltiplas instâncias permitem separar campanhas por conta.</p>
                </div>
                <div className="flex flex-col gap-2.5 min-w-0">
                  {instances.length === 0 ? (
                    <div className="flex items-center gap-2 py-4 text-[#a0a0a0] text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Carregando instâncias...</div>
                  ) : instances.map((inst) => {
                    const isSelected = selectedInstanceId === inst.id;
                    return (
                      <button key={inst.id} onClick={() => setSelectedInstanceId(inst.id)}
                        className={cn("flex items-start sm:items-center gap-4 p-4 rounded-xl border-2 text-left transition-all min-w-0",
                          isSelected ? "border-[#e24c30] bg-[#e24c30]/5 shadow-lg shadow-[#e24c30]/10"
                            : "border-[#2c2c32] bg-[#1c1c1f] hover:border-[#3e3e3e]")}>
                        <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-all",
                          isSelected ? "bg-[#e24c30]/10 border-[#e24c30]/30" : "bg-[#1c1c1f] border-[#2c2c32]")}>
                          <Smartphone className={cn("w-4 h-4", isSelected ? "text-[#e24c30]" : "text-[#a0a0a0]")} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className={cn("text-[12px] font-bold truncate", isSelected ? "text-white" : "text-[#d8d8d8]")}>{inst.nome_instancia}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span className="text-[9px] text-emerald-400 font-semibold">Conectada</span>
                          </div>
                        </div>
                        {isSelected && (
                          <div className="w-5 h-5 rounded-full bg-[#e24c30] flex items-center justify-center shrink-0">
                            <CheckCheck className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Selecionar lista */}
            {wizardStep === 2 && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <div className="relative flex-1 min-w-0">
                    <Search className="w-3.5 h-3.5 text-[#a0a0a0] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input type="text" value={listSearch} onChange={(e) => setListSearch(e.target.value)} placeholder="Buscar lista por nome..."
                      className="w-full bg-[#222228] border border-[#3e3e3e] rounded-lg pl-8 pr-8 py-2.5 sm:py-2 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition" />
                    {listSearch && <button onClick={() => setListSearch("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#a0a0a0] hover:text-white transition"><X className="w-3 h-3" /></button>}
                  </div>
                  <button type="button" onClick={openModalCriarLista}
                    className="w-full sm:w-auto flex items-center justify-center gap-2 shrink-0 bg-[#e24c30]/5 border border-[#e24c30]/25 hover:bg-[#e24c30]/10 hover:border-[#e24c30]/45 rounded-lg px-3.5 py-2.5 sm:py-2 transition-all group">
                    <div className="w-5 h-5 rounded-md bg-[#e24c30]/10 border border-[#e24c30]/20 flex items-center justify-center shrink-0 group-hover:bg-[#e24c30]/20 transition-all">
                      <PlusCircle className="w-3 h-3 text-[#e24c30]" />
                    </div>
                    <span className="text-[10px] font-bold text-[#e24c30]">Criar nova lista</span>
                  </button>
                </div>

                {loadingListas ? (
                  <div className="flex items-center gap-2 py-4 text-[#a0a0a0] text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Carregando listas...</div>
                ) : listaEditLoading ? (
                  <div className="flex items-center gap-2 py-4 text-[#a0a0a0] text-xs"><Loader2 className="w-4 h-4 animate-spin" /> Abrindo lista para edição…</div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-1.5 max-h-[192px] overflow-y-auto scrollbar-thin pr-1">
                    {filteredLists.length > 0 ? filteredLists.map((list) => {
                      const isSelected = selectedListaId === list.id;
                      return (
                        <div
                          key={list.id}
                          className={cn(
                            "flex min-w-0 items-stretch gap-0 rounded-xl border-2 transition-all",
                            isSelected ? "border-[#e24c30] bg-[#e24c30]/5" : "border-[#2c2c32] bg-[#1c1c1f] hover:border-[#3e3e3e]",
                          )}
                        >
                          <button
                            type="button"
                            onClick={() => setSelectedListaId(isSelected ? "" : list.id)}
                            className="flex min-w-0 flex-1 items-center gap-3 p-2.5 text-left"
                          >
                            <div
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border",
                                isSelected ? "border-[#e24c30]/30 bg-[#e24c30]/10" : "border-[#2c2c32] bg-[#1c1c1f]",
                              )}
                            >
                              <ListIcon className={cn("h-3.5 w-3.5", isSelected ? "text-[#e24c30]" : "text-[#a0a0a0]")} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className={cn("truncate text-[11px] font-bold", isSelected ? "text-white" : "text-[#d8d8d8]")}>
                                {list.nomeLista}
                              </p>
                              <p className="mt-0.5 truncate text-[9px] text-[#a0a0a0]">
                                {instances.find((i) => i.id === list.instanceId)?.nome_instancia ?? list.instanceId.slice(0, 8)}
                              </p>
                            </div>
                            {isSelected ? <CheckCheck className="h-3.5 w-3.5 shrink-0 text-[#e24c30]" /> : null}
                          </button>
                          <div className="flex shrink-0 flex-col justify-center gap-0.5 border-l border-[#2c2c32]/80 py-1 pl-0.5 pr-1">
                            <button
                              type="button"
                              title="Editar grupos da lista"
                              disabled={listaEditLoading || saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                void openModalEditarLista(list);
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a0a0a0] transition hover:bg-[#e24c30]/15 hover:text-[#e24c30] disabled:opacity-40"
                            >
                              <Pencil className="h-3 w-3" />
                            </button>
                            <button
                              type="button"
                              title="Apagar lista inteira"
                              disabled={deletingListaId === list.id || saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                setListaDeleteConfirm({ id: list.id, nome: list.nomeLista });
                              }}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a0a0a0] transition hover:bg-red-500/15 hover:text-red-400 disabled:opacity-40"
                            >
                              {deletingListaId === list.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                <Trash2 className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                        </div>
                      );
                    }) : (
                      <div className="col-span-full flex flex-col items-center justify-center gap-2 py-8 text-center">
                        <Search className="w-6 h-6 text-[#2c2c32]" />
                        <p className="text-[11px] font-semibold text-[#a0a0a0]">Nenhuma lista encontrada</p>
                        <p className="text-[9px] text-[#a0a0a0]/60">Tente um nome diferente ou crie uma nova lista.</p>
                      </div>
                    )}
                  </div>
                )}

                {saving && <p className="text-xs text-text-secondary flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando lista...</p>}

                {selectedList && (
                  <div className="flex items-start sm:items-center gap-2.5 bg-[#e24c30]/5 border border-[#e24c30]/20 rounded-lg px-4 py-2.5">
                    <CheckCheck className="w-3.5 h-3.5 text-[#e24c30] shrink-0 mt-0.5 sm:mt-0" />
                    <p className="text-[10px] font-semibold text-white leading-relaxed">
                      <span className="text-[#e24c30]">{selectedList.nomeLista}</span> selecionada
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Conteúdo + Sub IDs */}
            {wizardStep === 3 && (
              <div
                className={cn(
                  "grid grid-cols-1 gap-4 sm:gap-6",
                  showSubIdsRastreamentoStep3 && "md:grid-cols-2",
                )}
              >
                <div className="flex flex-col gap-3 min-w-0">
                  <FieldLabel>Tipo de Conteúdo</FieldLabel>
                  <div className="flex flex-col sm:flex-row rounded-xl overflow-hidden border border-[#2c2c32]">
                    <button onClick={() => setContentMode("keywords")}
                      className={cn("flex-1 flex items-center justify-start sm:justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all sm:border-r border-[#2c2c32]",
                        contentMode === "keywords" ? "bg-[#e24c30]/15 text-[#e24c30]" : "bg-[#222228] text-[#a0a0a0] hover:text-white")}>
                      <Hash className="w-3 h-3" /> Keywords
                    </button>
                    <button onClick={() => setContentMode("list")}
                      className={cn("flex-1 flex items-center justify-start sm:justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all border-t sm:border-t-0 border-[#2c2c32]",
                        contentMode === "list" ? "bg-[#e24c30]/15 text-[#e24c30]" : "bg-[#222228] text-[#a0a0a0] hover:text-white")}>
                      <Layers className="w-3 h-3" /> Lista de Ofertas
                    </button>
                  </div>

                  {contentMode === "keywords" ? (
                    <div className="flex flex-col gap-1.5 min-w-0">
                      <FieldLabel>Keywords (uma por linha)</FieldLabel>
                      <textarea value={keywords} onChange={(e) => setKeywords(e.target.value)}
                        placeholder={"camisa masculina\ntenis corrida\nfone bluetooth"}
                        className="w-full h-[140px] bg-[#222228] border border-[#3e3e3e] rounded-xl p-3.5 text-[11px] text-[#f0f0f2] placeholder:text-[#868686] focus:border-[#e24c30] outline-none resize-none scrollbar-thin leading-relaxed transition" />
                      <p className="text-[9px] text-[#a0a0a0] leading-relaxed">{keywordCount} keyword{keywordCount !== 1 ? "s" : ""} · 1 produto por keyword por grupo.</p>
                    </div>
                  ) : (
                    <div className="min-w-0">
                      <FieldLabel>Origem da lista</FieldLabel>
                      {/*
                        Todos os 4 botões ficam SEMPRE visíveis como gatilho de venda.
                        ML/Crossover ficam bloqueados (cadeado) pra Inicial/Trial.
                        Infoprodutor idem. Click no bloqueado abre banner de upgrade
                        e NÃO troca a source.
                      */}
                      <div className="grid grid-cols-2 sm:grid-cols-5 gap-0 rounded-xl overflow-hidden border border-[#2c2c32] mb-3">
                        <button
                          type="button"
                          onClick={() => {
                            setOfferListSource("shopee");
                            setSelectedListaOfertasMlId("");
                            setSelectedListaOfertasAmazonId("");
                            setSelectedListaOfertasInfoId("");
                            setLockedSourcePrompt(null);
                          }}
                          className={cn(
                            "flex items-center justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all sm:border-r border-[#2c2c32]",
                            offerListSource === "shopee" ? "bg-[#e24c30]/15 text-[#e24c30]" : "bg-[#222228] text-[#a0a0a0] hover:text-white",
                          )}
                        >
                          <Image
                            src="/icons-integracoes/shopee-icon-laranja2.svg"
                            alt=""
                            width={12}
                            height={12}
                            className="h-3 w-3 object-contain shrink-0"
                            aria-hidden
                          />
                          <span className="text-center leading-tight">Shopee</span>
                        </button>
                        <button
                          type="button"
                          aria-disabled={!canUseMlSource}
                          onClick={() => {
                            if (!canUseMlSource) {
                              setLockedSourcePrompt("ml");
                              return;
                            }
                            setOfferListSource("ml");
                            setSelectedListaOfertasId("");
                            setSelectedListaOfertasAmazonId("");
                            setSelectedListaOfertasInfoId("");
                            setLockedSourcePrompt(null);
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-[10px] font-bold transition-all border-l sm:border-l border-[#2c2c32] sm:flex-row sm:gap-2 sm:px-3 relative",
                            offerListSource === "ml" && canUseMlSource
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-[#222228] text-[#a0a0a0] hover:text-white",
                            !canUseMlSource && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <Image
                            src="/ml.png"
                            alt=""
                            width={24}
                            height={24}
                            className="h-3 w-3 object-contain shrink-0"
                            aria-hidden
                          />
                          <span className="text-center leading-tight">Mercado Livre</span>
                          {!canUseMlSource ? (
                            <Lock className="w-3 h-3 shrink-0 text-shopee-orange" aria-hidden="true" />
                          ) : MERCADOLIVRE_UX_COMING_SOON ? (
                            <span className="shrink-0 rounded bg-red-600 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-white">
                              Em breve
                            </span>
                          ) : null}
                        </button>
                        <button
                          type="button"
                          aria-disabled={!canUseAmazonSource}
                          onClick={() => {
                            if (!canUseAmazonSource) {
                              setLockedSourcePrompt("amazon");
                              return;
                            }
                            setOfferListSource("amazon");
                            setSelectedListaOfertasId("");
                            setSelectedListaOfertasMlId("");
                            setSelectedListaOfertasInfoId("");
                            setLockedSourcePrompt(null);
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-[10px] font-bold transition-all border-t sm:border-t-0 sm:border-l border-[#2c2c32] sm:flex-row sm:gap-2 sm:px-3 relative",
                            offerListSource === "amazon" && canUseAmazonSource
                              ? "bg-amber-500/15 text-amber-400"
                              : "bg-[#222228] text-[#a0a0a0] hover:text-white",
                            !canUseAmazonSource && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src="/amazonlogo.webp" alt="" className="w-3 h-3 object-contain shrink-0" aria-hidden />
                          <span className="text-center leading-tight">Amazon</span>
                          {!canUseAmazonSource && (
                            <Lock className="w-3 h-3 shrink-0 text-shopee-orange" aria-hidden="true" />
                          )}
                        </button>
                        <button
                          type="button"
                          aria-disabled={!canUseMlSource && !canUseAmazonSource}
                          onClick={() => {
                            if (!canUseMlSource && !canUseAmazonSource) {
                              setLockedSourcePrompt("ml");
                              return;
                            }
                            setOfferListSource("crossover");
                            setLockedSourcePrompt(null);
                          }}
                          className={cn(
                            "flex flex-col items-center justify-center gap-1 px-2 py-2.5 text-[10px] font-bold transition-all border-t sm:border-t-0 sm:border-l border-[#2c2c32] sm:flex-row sm:gap-2 sm:px-3 relative",
                            offerListSource === "crossover" && (canUseMlSource || canUseAmazonSource)
                              ? "bg-gradient-to-br from-[#e24c30]/20 to-amber-500/15 text-[#f0f0f2] ring-1 ring-inset ring-amber-500/30 light:from-orange-100/95 light:to-amber-50 light:ring-amber-200/70"
                              : "bg-[#222228] text-[#a0a0a0] hover:text-white light:bg-zinc-100 light:text-zinc-600 light:hover:text-zinc-900",
                            !canUseMlSource && !canUseAmazonSource && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <ArrowLeftRight className="w-3 h-3 shrink-0" aria-hidden />
                          <span className="text-center leading-tight">Crossover</span>
                          {!canUseMlSource && !canUseAmazonSource ? (
                            <Lock className="w-3 h-3 shrink-0 text-shopee-orange" aria-hidden="true" />
                          ) : null}
                        </button>
                        <button
                          type="button"
                          aria-disabled={!canUseInfoSource}
                          onClick={() => {
                            if (!canUseInfoSource) {
                              setLockedSourcePrompt("info");
                              return;
                            }
                            setOfferListSource("infoprodutor");
                            setSelectedListaOfertasId("");
                            setSelectedListaOfertasMlId("");
                            setSelectedListaOfertasAmazonId("");
                            setLockedSourcePrompt(null);
                          }}
                          className={cn(
                            "flex items-center justify-center gap-2 px-3 py-2.5 text-[10px] font-bold transition-all border-t sm:border-t-0 border-l border-[#2c2c32] relative",
                            offerListSource === "infoprodutor" && canUseInfoSource
                              ? "bg-emerald-500/15 text-emerald-400 light:bg-emerald-100/90 light:text-emerald-900"
                              : "bg-[#222228] text-[#a0a0a0] hover:text-white light:bg-zinc-100 light:text-zinc-600 light:hover:text-zinc-900",
                            !canUseInfoSource && "opacity-60 cursor-not-allowed",
                          )}
                        >
                          <ShoppingCart className="w-3 h-3 shrink-0" aria-hidden />
                          <span className="text-center leading-tight">Infoprodutor</span>
                          {!canUseInfoSource && (
                            <Lock className="w-3 h-3 shrink-0 text-shopee-orange" aria-hidden="true" />
                          )}
                        </button>
                      </div>
                      {lockedSourcePrompt && (
                        <div className="mb-3">
                          <UpgradePlanNotice
                            title={
                              lockedSourcePrompt === "ml"
                                ? "Mercado Livre e Crossover são exclusivos do Plano Padrão"
                                : lockedSourcePrompt === "amazon"
                                  ? "Amazon é exclusivo do Plano Padrão"
                                  : "Infoprodutor é exclusivo do Plano Padrão"
                            }
                            description={`Faça upgrade pra desbloquear listas ${
                              lockedSourcePrompt === "ml"
                                ? "do Mercado Livre, mix Shopee+ML+Amazon (Crossover)"
                                : lockedSourcePrompt === "amazon"
                                  ? "da Amazon, mix com Shopee/ML/Infoprodutor (Crossover)"
                                  : "de Infoprodutor"
                            } e muito mais.`}
                            onClose={() => setLockedSourcePrompt(null)}
                            currentPlanToneForPricing={subscriptionToneForPlanTier(tier)}
                            userSubscriptionBillingQuarterly={billingQuarterly}
                          />
                        </div>
                      )}
                      {isGruposVendaMlOfferBlocked(offerListSource) ? null : (
                        <>
                          {offerListSource === "crossover" ? (
                            <div className="mb-3 min-w-0 space-y-2">
                              <p className="text-[10px] text-[#a0a0a0] leading-relaxed light:text-zinc-600">
                                Selecione ao menos{" "}
                                <span className="font-semibold text-[#f0f0f2] light:text-zinc-900">2 listas</span>. O disparo só usa as fontes em que você escolher uma lista; as demais ficam de fora do rolê.
                              </p>
                              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                                <div className="min-w-0 rounded-lg border border-[#2c2c32] bg-[#18181c]/40 p-3 light:border-orange-200/80 light:bg-white light:shadow-sm">
                                  <FieldLabel>Lista</FieldLabel>
                                  <p className="text-[11px] font-semibold text-[#f0f0f2] mb-2 light:text-zinc-900">Shopee</p>
                                  {loadingListasOfertas ? (
                                    <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                                    </div>
                                  ) : (
                                    <MetaSearchablePicker
                                      value={selectedListaOfertasId}
                                      onChange={setSelectedListaOfertasId}
                                      options={[
                                        {
                                          value: "",
                                          label: "—",
                                          description: "Não usar Shopee neste crossover",
                                        },
                                        ...listasOfertas.map((l) => ({
                                          value: l.id,
                                          label: stripShoiaListNamePrefix(l.nome),
                                          description: `${l.totalItens} ${l.totalItens === 1 ? "item" : "itens"}`,
                                          ...(isShoiaListName(l.nome)
                                            ? { leadingImageSrc: SHOIA_LIST_LEADING_IMAGE_SRC, leadingImageAlt: "" }
                                            : {}),
                                        })),
                                      ]}
                                      modalTitle="Lista de ofertas Shopee"
                                      modalDescription="Lista salva em Minha Lista de Ofertas (Shopee)."
                                      searchPlaceholder="Filtrar listas…"
                                      emptyButtonLabel="Escolher lista"
                                      emptyAsTag
                                      emptyTagLabel="Buscar"
                                      emptyOptionsMessage="Nenhuma lista cadastrada."
                                      className="w-full max-w-full"
                                    />
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "min-w-0 rounded-lg border border-[#2c2c32] bg-[#18181c]/40 p-3 light:border-orange-200/80 light:bg-white light:shadow-sm",
                                    !canUseMlSource && "opacity-60",
                                  )}
                                >
                                  <FieldLabel>Lista</FieldLabel>
                                  <p className="text-[11px] font-semibold text-[#f0f0f2] mb-2 flex items-center gap-1 light:text-zinc-900">
                                    Mercado Livre
                                    {!canUseMlSource && <Lock className="w-3 h-3 text-shopee-orange" aria-hidden />}
                                  </p>
                                  {loadingListasOfertasMl ? (
                                    <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                                    </div>
                                  ) : (
                                    <MetaSearchablePicker
                                      value={selectedListaOfertasMlId}
                                      onChange={setSelectedListaOfertasMlId}
                                      options={listaOfertasMlPickerOptions}
                                      modalTitle="Lista de ofertas Mercado Livre"
                                      modalDescription="Listas com links de afiliado já convertidos (página Lista de Ofertas - ML)."
                                      searchPlaceholder="Filtrar listas…"
                                      emptyButtonLabel="Escolher lista"
                                      emptyAsTag
                                      emptyTagLabel="Buscar"
                                      emptyOptionsMessage="Nenhuma lista ML cadastrada."
                                      disabled={!canUseMlSource}
                                      className="w-full max-w-full"
                                    />
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "min-w-0 rounded-lg border border-[#2c2c32] bg-[#18181c]/40 p-3 light:border-orange-200/80 light:bg-white light:shadow-sm",
                                    !canUseAmazonSource && "opacity-60",
                                  )}
                                >
                                  <FieldLabel>Lista</FieldLabel>
                                  <p className="text-[11px] font-semibold text-[#f0f0f2] mb-2 flex items-center gap-1 light:text-zinc-900">
                                    Amazon
                                    {!canUseAmazonSource && <Lock className="w-3 h-3 text-shopee-orange" aria-hidden />}
                                  </p>
                                  {loadingListasOfertasAmazon ? (
                                    <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                                    </div>
                                  ) : (
                                    <MetaSearchablePicker
                                      value={selectedListaOfertasAmazonId}
                                      onChange={setSelectedListaOfertasAmazonId}
                                      options={listaOfertasAmazonPickerOptions}
                                      modalTitle="Lista de ofertas Amazon"
                                      modalDescription="Listas com links de afiliado Amazon (página Lista de Ofertas - Amazon)."
                                      searchPlaceholder="Filtrar listas…"
                                      emptyButtonLabel="Escolher lista"
                                      emptyAsTag
                                      emptyTagLabel="Buscar"
                                      emptyOptionsMessage="Nenhuma lista Amazon cadastrada."
                                      disabled={!canUseAmazonSource}
                                      className="w-full max-w-full"
                                    />
                                  )}
                                </div>
                                <div
                                  className={cn(
                                    "min-w-0 rounded-lg border border-[#2c2c32] bg-[#18181c]/40 p-3 light:border-orange-200/80 light:bg-white light:shadow-sm",
                                    !canUseInfoSource && "opacity-60",
                                  )}
                                >
                                  <FieldLabel>Lista</FieldLabel>
                                  <p className="text-[11px] font-semibold text-[#f0f0f2] mb-2 flex items-center gap-1 light:text-zinc-900">
                                    Infoprodutor
                                    {!canUseInfoSource && <Lock className="w-3 h-3 text-shopee-orange" aria-hidden />}
                                  </p>
                                  {loadingListasOfertasInfo ? (
                                    <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando…
                                    </div>
                                  ) : (
                                    <MetaSearchablePicker
                                      value={selectedListaOfertasInfoId}
                                      onChange={setSelectedListaOfertasInfoId}
                                      options={listaOfertasInfoPickerOptions}
                                      modalTitle="Lista do Infoprodutor"
                                      modalDescription="Listas com produtos cadastrados na página Infoprodutor."
                                      searchPlaceholder="Filtrar listas…"
                                      emptyButtonLabel="Escolher lista"
                                      emptyAsTag
                                      emptyTagLabel="Buscar"
                                      emptyOptionsMessage="Nenhuma lista cadastrada."
                                      disabled={!canUseInfoSource}
                                      className="w-full max-w-full"
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <>
                              {offerListSource === "shopee" && (
                                <div className="mb-3 min-w-0">
                                  <FieldLabel>Lista Shopee</FieldLabel>
                                  {loadingListasOfertas ? (
                                    <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando listas…
                                    </div>
                                  ) : (
                                    <MetaSearchablePicker
                                      value={selectedListaOfertasId}
                                      onChange={setSelectedListaOfertasId}
                                      options={listaOfertasPickerOptions}
                                      modalTitle="Lista de ofertas Shopee"
                                      modalDescription="Lista salva em Minha Lista de Ofertas (Shopee)."
                                      searchPlaceholder="Filtrar listas…"
                                      emptyButtonLabel="Escolher lista de ofertas"
                                      emptyAsTag
                                      emptyTagLabel="Selecionar Lista"
                                      emptyOptionsMessage="Nenhuma lista cadastrada."
                                      className="w-full max-w-full"
                                    />
                                  )}
                                </div>
                              )}
                              {offerListSource === "ml" && (
                                <div className="mb-3 min-w-0">
                                  <FieldLabel>Lista Mercado Livre</FieldLabel>
                                  {loadingListasOfertasMl ? (
                                    <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando listas ML…
                                    </div>
                                  ) : (
                                    <MetaSearchablePicker
                                      value={selectedListaOfertasMlId}
                                      onChange={setSelectedListaOfertasMlId}
                                      options={listaOfertasMlPickerOptions}
                                      modalTitle="Lista de ofertas Mercado Livre"
                                      modalDescription="Listas com links de afiliado já convertidos (página Lista de Ofertas - ML)."
                                      searchPlaceholder="Filtrar listas…"
                                      emptyButtonLabel="Escolher lista ML"
                                      emptyAsTag
                                      emptyTagLabel="Selecionar Lista ML"
                                      emptyOptionsMessage="Nenhuma lista ML cadastrada."
                                      className="w-full max-w-full"
                                    />
                                  )}
                                </div>
                              )}
                              {offerListSource === "amazon" && (
                                <div className="mb-3 min-w-0">
                                  <FieldLabel>Lista Amazon</FieldLabel>
                                  {loadingListasOfertasAmazon ? (
                                    <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando listas Amazon…
                                    </div>
                                  ) : (
                                    <MetaSearchablePicker
                                      value={selectedListaOfertasAmazonId}
                                      onChange={setSelectedListaOfertasAmazonId}
                                      options={listaOfertasAmazonPickerOptions}
                                      modalTitle="Lista de ofertas Amazon"
                                      modalDescription="Listas com links de afiliado Amazon (página Lista de Ofertas - Amazon)."
                                      searchPlaceholder="Filtrar listas…"
                                      emptyButtonLabel="Escolher lista Amazon"
                                      emptyAsTag
                                      emptyTagLabel="Selecionar Lista Amazon"
                                      emptyOptionsMessage="Nenhuma lista Amazon cadastrada."
                                      className="w-full max-w-full"
                                    />
                                  )}
                                </div>
                              )}
                              {offerListSource === "infoprodutor" && (
                                <div className="mb-1 min-w-0">
                                  <FieldLabel>Lista Infoprodutor</FieldLabel>
                                  {loadingListasOfertasInfo ? (
                                    <div className="flex items-center gap-2 text-[#a0a0a0] text-xs py-2">
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Carregando listas…
                                    </div>
                                  ) : (
                                    <MetaSearchablePicker
                                      value={selectedListaOfertasInfoId}
                                      onChange={setSelectedListaOfertasInfoId}
                                      options={listaOfertasInfoPickerOptions}
                                      modalTitle="Lista do Infoprodutor"
                                      modalDescription="Listas com produtos cadastrados por você na página Infoprodutor."
                                      searchPlaceholder="Filtrar listas…"
                                      emptyButtonLabel="Escolher lista Infoprodutor"
                                      emptyAsTag
                                      emptyTagLabel="Selecionar Lista"
                                      emptyOptionsMessage="Nenhuma lista cadastrada."
                                      className="w-full max-w-full"
                                    />
                                  )}
                                </div>
                              )}
                            </>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Sub IDs — desktop (keywords ou lista Shopee apenas) */}
                {showSubIdsRastreamentoStep3 && (
                  <div className="hidden md:flex flex-col gap-3 min-w-0">
                    <FieldLabel>
                      <span className="inline-flex items-center gap-1 flex-wrap">
                        <Tag className="w-2.5 h-2.5" /> Sub IDs de Rastreamento
                        <span className="text-[8px] normal-case tracking-normal font-normal text-[#a0a0a0] ml-1">(opcional)</span>
                      </span>
                    </FieldLabel>
                    <div className="flex flex-col gap-2">
                      {[
                        { label: "subId1", value: subId1, setter: setSubId1, ph: "Canal (ex: Whatsapp)" },
                        { label: "subId2", value: subId2, setter: setSubId2, ph: "Lista (ex: Camisa Anime)" },
                        { label: "subId3", value: subId3, setter: setSubId3, ph: "Campanha (ex: Natal)" },
                      ].map(({ label, value, setter, ph }) => (
                        <div key={label} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-3">
                          <input type="text" value={value} onChange={(e) => setter(e.target.value)} placeholder={ph}
                            className="w-full flex-1 bg-[#222228] border border-[#3e3e3e] rounded-lg px-3 py-2.5 sm:py-2 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Sub IDs — mobile (keywords ou lista Shopee apenas) */}
                {showSubIdsRastreamentoStep3 && (
                  <div className="md:hidden min-w-0 flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setMobileSubIdsOpen((o) => !o)}
                      aria-expanded={mobileSubIdsOpen}
                      className="w-full flex items-center justify-between gap-3 rounded-xl bg-[#1a1a1c] border border-[#2c2c32] px-4 py-3 text-left transition hover:border-[#3e3e3e] active:scale-[0.99]"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest flex items-center gap-1.5">
                          <Tag className="w-2.5 h-2.5 text-[#e24c30] shrink-0" />
                          Sub IDs de Rastreamento
                          <span className="text-[8px] normal-case tracking-normal font-normal text-[#a0a0a0]">(opcional)</span>
                        </p>
                        <p className="text-[10px] text-[#f0f0f2] mt-1 truncate">{subIdsMobileSummary}</p>
                      </div>
                      <ChevronDown
                        className={cn(
                          "w-4 h-4 shrink-0 text-[#f0f0f2] transition-transform duration-200",
                          mobileSubIdsOpen && "rotate-180",
                        )}
                        aria-hidden
                      />
                    </button>
                    {mobileSubIdsOpen && (
                      <div className="flex flex-col gap-2 pl-0.5 pt-1 border border-[#2c2c32] rounded-xl bg-[#222228]/50 p-3">
                        {[
                          { label: "subId1", value: subId1, setter: setSubId1, ph: "Canal (ex: Whatsapp)" },
                          { label: "subId2", value: subId2, setter: setSubId2, ph: "Lista (ex: Camisa Anime)" },
                          { label: "subId3", value: subId3, setter: setSubId3, ph: "Campanha (ex: Natal)" },
                        ].map(({ label, value, setter, ph }) => (
                          <div key={label} className="flex flex-col gap-1.5">
                            <input
                              type="text"
                              value={value}
                              onChange={(e) => setter(e.target.value)}
                              placeholder={ph}
                              className="w-full bg-[#222228] border border-[#3e3e3e] rounded-lg px-3 py-2.5 text-[10px] text-white placeholder:text-[#868686] focus:border-[#e24c30] outline-none transition"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Step 4: Horário + Resumo */}
            {wizardStep === 4 && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl p-4 min-w-0">
                  <div className="flex flex-col gap-2 mb-4">
                    <label className="flex items-center gap-1.5 text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest leading-relaxed">
                      <Clock className="w-2.5 h-2.5 text-[#e24c30] shrink-0" /> Janela diária (máx. 14 h)
                    </label>
                    <p className="text-[10px] text-[#a0a0a0] leading-relaxed">
                      O disparo automático só roda entre o horário de <span className="text-white font-semibold">início</span> e <span className="text-white font-semibold">fim</span>.
                      A duração não pode passar de <span className="text-[#e24c30] font-semibold">14 horas seguidas</span> (pode atravessar meia-noite, ex.: 22:00 → 12:00).
                    </p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                    <div className="flex-1">
                      <p className="text-[8px] text-[#a0a0a0] mb-1.5 uppercase tracking-widest font-bold">Início</p>
                      <input type="time" value={horaInicio} onChange={(e) => setHoraInicio(e.target.value)}
                        className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#e24c30] outline-none text-center transition" />
                    </div>
                    <span className="hidden sm:block text-[#a0a0a0] mt-4">→</span>
                    <div className="flex-1">
                      <p className="text-[8px] text-[#a0a0a0] mb-1.5 uppercase tracking-widest font-bold">Fim</p>
                      <input type="time" value={horaFim} onChange={(e) => setHoraFim(e.target.value)}
                        className="w-full bg-[#1c1c1f] border border-[#3e3e3e] rounded-lg px-3 py-2.5 text-xs text-white focus:border-[#e24c30] outline-none text-center transition" />
                    </div>
                  </div>
                  {janelaPreviewText && (
                    <p className={cn("text-[10px] mt-3 leading-relaxed", janelaPreviewText.variant === "error" ? "text-amber-400" : "text-emerald-400/90")}>
                      {janelaPreviewText.text}
                    </p>
                  )}
                </div>

                <div className="bg-[#1c1c1f] border border-[#2c2c32] rounded-xl min-w-0 overflow-hidden">
                  {/* Mobile: cabeçalho dropdown (começa recolhido) */}
                  <button
                    type="button"
                    onClick={() => setMobileResumoOpen((o) => !o)}
                    aria-expanded={mobileResumoOpen}
                    className="md:hidden w-full flex items-center justify-between gap-3 px-4 py-3 text-left transition hover:bg-[#1c1c1f]/80"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest">Resumo da Automação</p>
                      <p className="text-[10px] text-[#f0f0f2] mt-1 truncate">
                        {instances.find((i) => i.id === selectedInstanceId)?.nome_instancia ?? "Canal"}{" "}
                        ·{" "}
                        {contentMode === "keywords"
                          ? `${keywordCount} keyword${keywordCount !== 1 ? "s" : ""}`
                          : offerListSource === "crossover"
                            ? "Crossover Shopee + ML"
                            : offerListSource === "ml"
                              ? "Lista ML"
                              : offerListSource === "infoprodutor"
                                ? "Lista Infoprodutor"
                                : "Lista Shopee"}{" "}
                        · {horaInicio && horaFim ? `${horaInicio}–${horaFim}` : "Definir janela"}
                        {" "}
                        · A cada 10 min
                      </p>
                    </div>
                    <ChevronDown
                      className={cn(
                        "w-4 h-4 shrink-0 text-[#f0f0f2] transition-transform duration-200",
                        mobileResumoOpen && "rotate-180",
                      )}
                      aria-hidden
                    />
                  </button>

                  {/* Desktop: título fixo */}
                  <p className="hidden md:block text-[9px] font-bold text-[#d8d8d8] uppercase tracking-widest px-4 pt-4 mb-4">
                    Resumo da Automação
                  </p>

                  <div
                    className={cn(
                      "flex flex-col gap-3 px-4 pb-4 max-md:border-t max-md:border-[#2c2c32] max-md:pt-3 md:pt-0",
                      !mobileResumoOpen && "max-md:hidden",
                    )}
                  >
                    {[
                      { icon: <Smartphone className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Canal", value: instances.find((i) => i.id === selectedInstanceId)?.nome_instancia ?? "Não selecionado", warn: !selectedInstanceId },
                      { icon: <ListIcon className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Lista", value: selectedList?.nomeLista ?? null, warn: !selectedList },
                      {
                        icon: <Hash className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />,
                        label: "Conteúdo",
                        value:
                          contentMode === "keywords"
                            ? `${keywordCount} keyword${keywordCount !== 1 ? "s" : ""}`
                            : offerListSource === "crossover"
                              ? "Crossover (Shopee + Mercado Livre)"
                              : offerListSource === "ml"
                                ? "Lista Mercado Livre"
                                : offerListSource === "infoprodutor"
                                  ? "Lista Infoprodutor"
                                  : "Lista Shopee",
                        warn: false,
                      },
                      { icon: <Clock className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />, label: "Horário", value: horaInicio && horaFim ? `${horaInicio} – ${horaFim} (máx. 14 h)` : "Defina início e fim da janela", warn: false },
                      {
                        icon: <Send className="w-3.5 h-3.5 text-[#e24c30] shrink-0" />,
                        label: "Envios",
                        value: "A cada 10 minutos",
                        warn: false,
                      },
                    ].map(({ icon, label, value, warn }) => (
                      <div key={label} className="flex items-start gap-3 py-2 border-b border-[#2c2c32] last:border-0 min-w-0">
                        <div className="w-6 h-6 rounded-lg bg-[#1c1c1f] border border-[#2c2c32] flex items-center justify-center shrink-0">{icon}</div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[8px] text-[#a0a0a0] uppercase tracking-widest font-bold">{label}</p>
                          {warn ? (
                            <p className="text-[10px] text-amber-400 font-semibold mt-0.5">Nenhuma selecionada</p>
                          ) : (
                            <p className="text-[10px] text-white font-semibold mt-0.5 break-words">{value}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer wizard */}
          <div className="px-4 sm:px-6 py-4 border-t border-[#2c2c32] bg-[#191920] flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3 rounded-b-xl sm:rounded-b-2xl">
            <button onClick={handleBack} disabled={wizardStep === 1}
              className={cn("w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all border",
                wizardStep === 1 ? "text-[#a0a0a0]/30 border-[#2c2c32]/30 cursor-not-allowed"
                  : "text-[#a0a0a0] border-[#2c2c32] hover:text-white hover:border-[#3e3e3e] bg-[#222228]")}>
              <ChevronLeft className="w-3.5 h-3.5" /> Voltar
            </button>
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
              <div className="hidden sm:flex items-center gap-1.5 mr-2">
                {WIZARD_STEPS.map((s) => (
                  <div key={s.id} className={cn("rounded-full transition-all",
                    s.id === wizardStep ? "w-4 h-1.5 bg-[#e24c30]"
                      : s.id < wizardStep ? "w-1.5 h-1.5 bg-emerald-500/50"
                      : "w-1.5 h-1.5 bg-[#2c2c32]")} />
                ))}
              </div>
              {wizardStep < 4 ? (
                <button onClick={handleNext}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 bg-[#e24c30] hover:bg-[#c94028] text-white px-5 py-2.5 rounded-xl text-[11px] font-bold transition-all shadow-lg shadow-[#e24c30]/20">
                  Avançar <ChevronRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleFinish}
                  disabled={
                    (!!continuoTogglingId && (continuoTogglingId === "new" || continuoTogglingId === editingContinuoId))
                    || !podeAtivarAutomacao
                  }
                  title={!podeAtivarAutomacao && erroJanelaAtivar ? erroJanelaAtivar : undefined}
                  className={cn(
                    "w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-bold transition-all shadow-lg group bg-[#e24c30]/10 border border-[#e24c30]/25 text-[#e24c30] hover:bg-[#e24c30] hover:text-white shadow-[#e24c30]/5",
                    "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#e24c30]/10 disabled:hover:text-[#e24c30] disabled:shadow-none",
                  )}
                >
                  {(continuoTogglingId === "new" || continuoTogglingId === editingContinuoId) ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : editingContinuoId ? (
                    <Pencil className="w-3.5 h-3.5" />
                  ) : (
                    <Play className="w-3.5 h-3.5 fill-current" />
                  )}
                  {editingContinuoId ? "Salvar alterações" : "Ativar automação"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal buscar grupos */}
      <BuscarGruposModal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setListaModalEdicaoId(null);
          setListaEditPrefill(null);
        }}
        onConfirm={handleConfirmGroups}
        criarListaMode
        initialInstanceId={selectedInstanceId || undefined}
        listaIdEdicao={listaModalEdicaoId}
        listaNomeInicial={listaEditPrefill?.nomeLista}
        gruposListaInicial={listaEditPrefill?.grupos ?? null}
      />

      {listaDeleteConfirm &&
        createPortal(
          <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6" role="presentation">
            <button
              type="button"
              aria-label="Fechar"
              className="absolute inset-0 z-0 bg-black/65 backdrop-blur-[2px] transition-opacity"
              onClick={() => setListaDeleteConfirm(null)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="lista-delete-title"
              className="relative z-10 w-full max-w-[400px] rounded-2xl border border-[#2c2c32] bg-[#1c1c1f] p-5 shadow-2xl shadow-black/50"
            >
              <h2 id="lista-delete-title" className="text-sm font-bold text-white">
                Apagar lista?
              </h2>
              <p className="mt-2 text-[12px] leading-relaxed text-[#b8b8bc]">
                A lista <span className="font-semibold text-white">«{listaDeleteConfirm.nome}»</span> será removida
                permanentemente. Automações que a usem deixarão de ter esta lista.
              </p>
              <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={() => setListaDeleteConfirm(null)}
                  className="rounded-xl border border-[#3e3e3e] px-4 py-2.5 text-[12px] font-semibold text-[#d8d8d8] transition hover:bg-[#222228]"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void handleDeleteLista(listaDeleteConfirm.id)}
                  className="rounded-xl bg-red-600 px-4 py-2.5 text-[12px] font-bold text-white shadow-lg transition hover:bg-red-500"
                >
                  Apagar lista
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}

      {wizardListaAlvoAlertOpen &&
        createPortal(
          <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6" role="presentation">
            <button
              type="button"
              aria-label="Fechar"
              className="absolute inset-0 z-0 bg-black/65 backdrop-blur-[2px] transition-opacity"
              onClick={() => setWizardListaAlvoAlertOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wizard-lista-alvo-alert-title"
              className="relative z-10 w-full max-w-[380px] rounded-2xl border border-[#2c2c32] bg-[#1c1c1f] p-5 shadow-2xl shadow-black/50"
            >
              <div className="flex gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e24c30]/25 bg-[#e24c30]/12">
                  <ListIcon className="h-5 w-5 text-[#e24c30]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id="wizard-lista-alvo-alert-title" className="text-sm font-bold text-white leading-snug">
                    Lista de grupos alvo
                  </h2>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#b8b8bc]">
                    Por favor, para continuar, selecione uma das suas listas!
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWizardListaAlvoAlertOpen(false)}
                className="mt-5 w-full rounded-xl bg-[#e24c30] px-4 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-[#e24c30]/25 transition hover:bg-[#c94028] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e24c30]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1f]"
              >
                Entendi
              </button>
            </div>
          </div>,
          document.body,
        )}

      {wizardKeywordsAlertOpen &&
        createPortal(
          <div className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6" role="presentation">
            <button
              type="button"
              aria-label="Fechar"
              className="absolute inset-0 z-0 bg-black/65 backdrop-blur-[2px] transition-opacity"
              onClick={() => setWizardKeywordsAlertOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="wizard-keywords-alert-title"
              className="relative z-10 w-full max-w-[380px] rounded-2xl border border-[#2c2c32] bg-[#1c1c1f] p-5 shadow-2xl shadow-black/50"
            >
              <div className="flex gap-3.5">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#e24c30]/25 bg-[#e24c30]/12">
                  <Hash className="h-5 w-5 text-[#e24c30]" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h2 id="wizard-keywords-alert-title" className="text-sm font-bold text-white leading-snug">
                    Keywords obrigatórias
                  </h2>
                  <p className="mt-2 text-[12px] leading-relaxed text-[#b8b8bc]">
                    Com <span className="text-white/90 font-semibold"># Keywords</span> selecionado, digite ao menos uma
                    keyword no campo (uma por linha). Depois você pode avançar.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setWizardKeywordsAlertOpen(false)}
                className="mt-5 w-full rounded-xl bg-[#e24c30] px-4 py-2.5 text-[12px] font-bold text-white shadow-lg shadow-[#e24c30]/25 transition hover:bg-[#c94028] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e24c30]/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1c1c1f]"
              >
                Entendi
              </button>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
