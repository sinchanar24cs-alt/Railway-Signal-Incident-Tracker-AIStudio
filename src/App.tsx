import { useCallback, useEffect, useState } from "react";
import { Sidebar, type NavTab } from "./components/Sidebar";
import { TopBar } from "./components/TopBar";
import { ReportDetailModal } from "./components/ReportDetailModal";
import { ReportSubmissionPage } from "./pages/ReportSubmissionPage";
import { UserDashboardPage } from "./pages/UserDashboardPage";
import { HandlerDashboardPage } from "./pages/HandlerDashboardPage";
import { RoutingManagementPage } from "./pages/RoutingManagementPage";
import { AnalyticsDashboardPage } from "./pages/AnalyticsDashboardPage";
import { AutomataLabPage } from "./pages/AutomataLabPage";
import { TestCentrePage } from "./pages/TestCentrePage";
import { api } from "./services/api";
import type { HandlerRecord, ReportRecord } from "./types";

const TAB_TITLES: Record<NavTab, string> = {
  submit: "Report Submission",
  dashboard: "User Dashboard",
  handlers: "Handler Dashboard",
  routing: "Routing Management",
  analytics: "Analytics Dashboard",
  automata: "Automata DFA Lab",
  tests: "Test Centre",
};

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>("submit");
  const [collapsed, setCollapsed] = useState(false);
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [handlers, setHandlers] = useState<HandlerRecord[]>([]);
  const [inspectReportId, setInspectReportId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setLoadError(null);
      const [repRes, hndRes] = await Promise.all([api.getReports(), api.getHandlers()]);
      setReports(repRes.reports);
      setHandlers(hndRes.handlers);
    } catch (err: unknown) {
      setLoadError((err as Error).message);
    }
  }, []);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  const handleResetDemo = async () => {
    await api.resetDemo();
    await refreshData();
  };

  return (
    <div className="min-h-screen bg-[#080d18] text-slate-100 flex">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        collapsed={collapsed}
        setCollapsed={setCollapsed}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          reports={reports}
          activeTitle={TAB_TITLES[activeTab]}
          onResetDemo={handleResetDemo}
          onSelectReport={setInspectReportId}
          onToggleMobileSidebar={() => setCollapsed(!collapsed)}
        />

        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          {loadError && (
            <div className="mb-4 bg-red-950/40 border border-red-700/60 rounded-lg p-3.5 text-xs text-red-200">
              Backend connection error: {loadError}
            </div>
          )}

          {activeTab === "submit" && (
            <ReportSubmissionPage
              onSubmitted={refreshData}
              onSelectReport={setInspectReportId}
            />
          )}
          {activeTab === "dashboard" && (
            <UserDashboardPage
              reports={reports}
              onSelectReport={setInspectReportId}
              onGoSubmit={() => setActiveTab("submit")}
            />
          )}
          {activeTab === "handlers" && (
            <HandlerDashboardPage
              handlers={handlers}
              reports={reports}
              onRefresh={refreshData}
              onSelectReport={setInspectReportId}
            />
          )}
          {activeTab === "routing" && (
            <RoutingManagementPage
              handlers={handlers}
              onRefreshGlobal={refreshData}
              onSelectReport={setInspectReportId}
            />
          )}
          {activeTab === "analytics" && <AnalyticsDashboardPage />}
          {activeTab === "automata" && <AutomataLabPage />}
          {activeTab === "tests" && <TestCentrePage />}
        </main>
      </div>

      <ReportDetailModal
        reportId={inspectReportId}
        onClose={() => setInspectReportId(null)}
      />
    </div>
  );
}
