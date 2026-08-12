import type { OnboardingProgressDTO, ProgressStepDTO } from "@vendor-management/shared";
import { Card } from "./ui.js";

function StepIcon({ status }: { status: ProgressStepDTO["status"] }) {
  const base = "grid h-5 w-5 shrink-0 place-items-center rounded-full text-[11px] font-bold";
  if (status === "done") return <span className={`${base} bg-emerald-600 text-white`}>✓</span>;
  if (status === "failed") return <span className={`${base} bg-rose-600 text-white`}>✕</span>;
  if (status === "current") return <span className={`${base} bg-indigo-600 text-white`}>●</span>;
  return <span className={`${base} border border-slate-300 text-slate-300`}>○</span>;
}

const groupLabels: Record<ProgressStepDTO["group"], string> = {
  vendor: "Your information",
  verification: "Verification",
  approval: "Internal review",
};

export function OnboardingProgress({ progress }: { progress: OnboardingProgressDTO }) {
  const grouped: Record<string, ProgressStepDTO[]> = {};
  for (const step of progress.steps) (grouped[step.group] ??= []).push(step);

  return (
    <Card>
      <div className="mb-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Onboarding progress</h2>
          <span className="text-sm font-semibold text-slate-900">{progress.percent}%</span>
        </div>
        <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${progress.percent}%` }}
          />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          {progress.completedSteps} of {progress.totalSteps} steps complete
        </p>
      </div>

      <div className="space-y-4">
        {(Object.keys(grouped) as ProgressStepDTO["group"][]).map((group) => (
          <div key={group}>
            <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-400">{groupLabels[group]}</p>
            <ul className="space-y-1.5">
              {grouped[group].map((step) => (
                <li key={step.key} className="flex items-center gap-2 text-sm">
                  <StepIcon status={step.status} />
                  <span
                    className={
                      step.status === "done"
                        ? "text-slate-500"
                        : step.status === "failed"
                          ? "font-medium text-rose-700"
                          : step.status === "current"
                            ? "font-medium text-slate-900"
                            : "text-slate-400"
                    }
                  >
                    {step.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {progress.currentAction && (
        <div className="mt-4 rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-2.5">
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-500">Current action</p>
          <p className="mt-0.5 font-medium text-slate-900">{progress.currentAction.title}</p>
          {progress.currentAction.detail && <p className="text-sm text-slate-600">{progress.currentAction.detail}</p>}
          <p className="mt-1 text-xs text-slate-500">
            Responsible: <span className="font-medium">{progress.currentAction.owner}</span>
          </p>
        </div>
      )}
    </Card>
  );
}
