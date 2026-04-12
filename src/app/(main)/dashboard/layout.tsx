"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import Link from "next/link";
import {
  Link2,
  BarChart3,
  MousePointerClick,
  ChevronRight,
  ExternalLink,
  Calculator,
  PanelsTopLeft,
  TrendingUp,
  Megaphone,
  ShoppingBag,
  Handshake,
  MessageCircle,
  ArrowLeftRight,
  ListChecks,
  Film,
  Lock,
  Sparkles,
} from "lucide-react";
import { usePathname } from "next/navigation";
import {
  PlanEntitlementsProvider,
  usePlanEntitlements,
} from "./PlanEntitlementsContext";
import { isTrialBlockedDashboardPath } from "@/lib/trial-dashboard-blocked-paths";
import { shouldShowPaidPlanUpsellInDashboard } from "@/lib/dashboard-paid-plan-upsell";
import DashboardPaidPlanUpsell from "./DashboardPaidPlanUpsell";
import type { PlanEntitlements } from "@/lib/plan-entitlements";

/** Qual flag de `PlanEntitlements` libera o item na sidebar (não use só `tier === "pro"` — staff/custom também podem ter essas flags). */
type ProSidebarFeature =
  | "ati"
  | "criarCampanhaMeta"
  | "geradorCriativos"
  | "espelhamentogrupos"
  | "especialistagenerate";

type NavItem = {
  title: string;
  href: string;
  icon: React.ReactNode;
  /** Item só para quem tem a feature Pro correspondente */
  proOnly?: boolean;
  /** Obrigatório quando `proOnly`: usado para cadeado/estilo, espelha o backend */
  proFeature?: ProSidebarFeature;
  /** Não mostrar na sidebar (rota continua acessível por URL direta). */
  hidden?: boolean;
};

const sidebarNavItems: NavItem[] = [
  {
    title: "Análise de Comissões",
    href: "/dashboard",
    icon: <BarChart3 className="h-5 w-5" />,
  },
  {
    title: "Análise de Cliques",
    href: "/dashboard/cliques",
    icon: <MousePointerClick className="h-5 w-5" />,
  },
  {
    title: "Meus Links",
    href: "/dashboard/links",
    icon: <Link2 className="h-5 w-5" />,
  },
  {
    title: "Site de Captura",
    href: "/dashboard/captura",
    icon: <PanelsTopLeft className="h-5 w-5" />,
  },
  {
    title: "Calculadora GPL",
    href: "/dashboard/gpl",
    icon: <Calculator className="h-5 w-5" />,
  },
  {
    title: "Tráfego Inteligente (ATI)",
    href: "/dashboard/ati",
    icon: <TrendingUp className="h-5 w-5" />,
    proOnly: true,
    proFeature: "ati",
  },
  {
    title: "Criar Campanha Meta",
    href: "/dashboard/meta-ads",
    icon: <Megaphone className="h-5 w-5" />,
    proOnly: true,
    proFeature: "criarCampanhaMeta",
  },
  {
    title: "Gerador de Links Shopee",
    href: "/dashboard/gerador-links-shopee",
    icon: <ShoppingBag className="h-5 w-5" />,
  },
  {
    title: "Gerador de Links ML",
    href: "/dashboard/minha-lista-ofertas-ml",
    icon: <Handshake className="h-5 w-5" />,
    hidden: false,
  },
  {
    title: "Automação de Grupos",
    href: "/dashboard/grupos-venda",
    icon: <MessageCircle className="h-5 w-5" />,
  },
  {
    title: "Espelhamento de grupos",
    href: "/dashboard/espelhamento-grupos",
    icon: <ArrowLeftRight className="h-5 w-5" />,
    proOnly: true,
    proFeature: "espelhamentogrupos",
  },
  {
    title: "Minha Lista de Ofertas",
    href: "/dashboard/minha-lista-ofertas",
    icon: <ListChecks className="h-5 w-5" />,
  },

  {
    title: "Gerador de Criativos",
    href: "/dashboard/video-editor",
    icon: <Film className="h-5 w-5" />,
    proOnly: true,
    proFeature: "geradorCriativos",
  },
  {
    title: "Gerador de Especialista",
    href: "/dashboard/gerador-especialista",
    icon: <Sparkles className="h-5 w-5" />,
    proOnly: true,
    proFeature: "especialistagenerate",
  },
];

function navItemLocked(
  item: NavItem,
  entitlements: PlanEntitlements | null
): boolean {
  const feature = item.proFeature;
  const hasFeature =
    feature && entitlements ? Boolean(entitlements[feature]) : false;
  if (item.proOnly === true && !hasFeature) return true;
  if (!entitlements) return false;
  if (item.href === "/dashboard/gpl") return !entitlements.gpl.enabled;
  if (item.href === "/dashboard/grupos-venda")
    return entitlements.gruposVenda.maxGroupsTotal <= 0;
  if (item.href === "/dashboard/minha-lista-ofertas")
    return entitlements.gruposVenda.maxLists === 0;
  return false;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PlanEntitlementsProvider>
      <DashboardLayoutInner>{children}</DashboardLayoutInner>
    </PlanEntitlementsProvider>
  );
}

function DashboardLayoutInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const { entitlements, tier, loading: entitlementsLoading } =
    usePlanEntitlements();

  const visibleItems = useMemo(() => {
    return sidebarNavItems.filter((item) => !item.hidden).map((item) => {
      return {
        ...item,
        locked: navItemLocked(item, entitlements),
      };
    });
  }, [entitlements]);

  const trialBlockedRoute = isTrialBlockedDashboardPath(pathname);
  const showTrialPaidUpsell =
    !entitlementsLoading &&
    shouldShowPaidPlanUpsellInDashboard(pathname, tier, entitlements);
  const showTrialBlockedLoading = entitlementsLoading && trialBlockedRoute;

  // Fechar com Escape e focar o primeiro link ao abrir
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isSidebarOpen) {
        setIsSidebarOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isSidebarOpen]);

  useEffect(() => {
    if (isSidebarOpen && sidebarRef.current) {
      const firstLink =
        sidebarRef.current.querySelector<HTMLAnchorElement>("a[href]");
      firstLink?.focus();
    }
  }, [isSidebarOpen]);

  function handleItemClick() {
    setIsSidebarOpen(false);
  }

  return (
    <div className="bg-dark-bg min-h-[calc(100vh-8rem)] flex text-text-primary">
      <button
        onClick={() => setIsSidebarOpen(true)}
        className={`lg:hidden fixed top-1/2 -translate-y-1/2 left-0 z-50
                    bg-shopee-orange p-2 pr-1 rounded-r-full border-y border-r border-shopee-orange
                    shadow-lg transition-all duration-300 ease-in-out
                    ${isSidebarOpen ? "-translate-x-24" : "translate-x-0"}`}
        aria-label="Abrir menu de navegação"
        aria-expanded={isSidebarOpen}
        aria-controls="sidebar-nav"
        type="button"
      >
        <ChevronRight className="h-6 w-6 text-white" />
      </button>

      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="lg:hidden fixed inset-0 bg-black/60 z-30 backdrop-blur-sm"
          aria-hidden="true"
        />
      )}

      <aside
        id="sidebar-nav"
        ref={sidebarRef}
        className={`fixed lg:static top-0 left-0 h-full lg:h-auto z-40 lg:z-auto w-64 flex-shrink-0 bg-dark-card border-r border-dark-border p-4 overflow-y-auto scrollbar-thin
                    transform transition-transform duration-300 ease-in-out
                    ${isSidebarOpen ? "translate-x-0" : "-translate-x-full"}
                    lg:translate-x-0`}
      >
        <nav
          role="navigation"
          aria-label="Navegação do dashboard"
          className="flex flex-col space-y-2"
        >
          {visibleItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => handleItemClick()}
                aria-current={isActive ? "page" : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-shopee-orange text-text-primary"
                    : item.locked
                    ? "text-text-secondary/40 hover:bg-dark-bg hover:text-text-secondary/60"
                    : "text-text-secondary hover:bg-dark-bg hover:text-text-primary"
                }`}
              >
                {item.icon}

                <span className="flex items-center gap-2 min-w-0">
                  <span className="truncate">{item.title}</span>

                  {item.locked && (
                    <Lock className="h-3 w-3 text-text-secondary/40 shrink-0" />
                  )}
                </span>
              </Link>
            );
          })}

          <div className="h-3" aria-hidden="true"></div>

          <Link
            href="https://www.youtube.com/playlist?list=PLt2etInlvKH1mUwYrUMOp8mBNcNsFh3WO"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors bg-dark-border text-text-primary hover:bg-dark-bg hover:text-link border border-dark-border"
            onClick={() => setIsSidebarOpen(false)}
            aria-label="Acessar Tutorial (abre em nova guia)"
          >
            <ExternalLink className="h-5 w-5" />
            Acessar Tutorial
          </Link>
        </nav>
      </aside>

      <main className="min-h-0 flex-grow p-6 md:p-8 overflow-auto lg:ml-[-256px] scrollbar-thin">
        <div className="lg:ml-64">
          {showTrialBlockedLoading ? (
            <div className="flex items-center justify-center py-20 text-text-secondary text-sm">
              Carregando...
            </div>
          ) : showTrialPaidUpsell ? (
            <DashboardPaidPlanUpsell />
          ) : (
            children
          )}
        </div>
      </main>
    </div>
  );
}