import { useState } from "react";
import {
  performanceBandLabels,
  performanceDimensionLabels,
  performanceDimensions,
  performanceWeights,
  type PerformanceBand,
  type RecordReviewInput,
  type ScorecardDTO,
  type VendorDetailDTO,
} from "@vendor-management/shared";
import { recordReview } from "../lib/performance.js";
import { Badge, Button, Card, ErrorText } from "./ui.js";

const bandTone: Record<PerformanceBand, Parameters<typeof Badge>[0]["tone"]> = {
  EXCELLENT: "success",
  GOOD: "success",
  FAIR: "progress",
  AT_RISK: "danger",
};

function ScoreBar({ label, value, weight }: { label: string; value: number | null; weight: number }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs">
        <span className="text-slate-600">
          {label} <span className="text-slate-400">· {weight}%</span>
        </span>
        <span className="font-medium text-slate-800">{value ?? "—"}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${value != null && value < 60 ? "bg-rose-500" : "bg-indigo-500"}`}
          style={{ width: `${value ?? 0}%` }}
        />
      </div>
    </div>
  );
}

const emptyForm = {
  period: "",
  qualityScore: 80,
  deliveryScore: 80,
  costScore: 80,
  responsivenessScore: 80,
  ppm: "",
  otifPercent: "",
  incidents: "",
  note: "",
};

function RecordReviewForm({ vendorId, onRecorded }: { vendorId: string; onRecorded: () => void }) {
  const [form, setForm] = useState({ ...emptyForm });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setNum(key: keyof typeof form, v: number) {
    setForm((f) => ({ ...f, [key]: v }));
  }

  async function submit() {
    setError(null);
    if (form.period.trim().length < 4) {
      setError("Enter a period label, e.g. 2026-Q2.");
      return;
    }
    setBusy(true);
    try {
      const input: RecordReviewInput = {
        period: form.period.trim(),
        qualityScore: form.qualityScore,
        deliveryScore: form.deliveryScore,
        costScore: form.costScore,
        responsivenessScore: form.responsivenessScore,
        ppm: form.ppm === "" ? undefined : Number(form.ppm),
        otifPercent: form.otifPercent === "" ? undefined : Number(form.otifPercent),
        incidents: form.incidents === "" ? undefined : Number(form.incidents),
        note: form.note.trim() === "" ? undefined : form.note.trim(),
      };
      await recordReview(vendorId, input);
      setForm({ ...emptyForm });
      onRecorded();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not record review");
    } finally {
      setBusy(false);
    }
  }

  const sliders = [
    ["qualityScore", "Quality"],
    ["deliveryScore", "Delivery (OTIF)"],
    ["costScore", "Cost"],
    ["responsivenessScore", "Responsiveness"],
  ] as const;

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Record a review</p>
      <label className="block text-xs text-slate-500">
        <span className="mb-1 block font-medium">Period</span>
        <input
          value={form.period}
          onChange={(e) => setForm((f) => ({ ...f, period: e.target.value }))}
          placeholder="2026-Q2"
          className="w-40 rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>

      {sliders.map(([key, label]) => (
        <label key={key} className="block text-xs text-slate-500">
          <span className="mb-1 flex justify-between font-medium">
            <span>{label}</span>
            <span className="text-slate-800">{form[key]}</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            value={form[key]}
            onChange={(e) => setNum(key, Number(e.target.value))}
            className="w-full accent-indigo-600"
          />
        </label>
      ))}

      <div className="grid grid-cols-3 gap-2">
        {(
          [
            ["ppm", "PPM"],
            ["otifPercent", "OTIF %"],
            ["incidents", "Incidents"],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="text-xs text-slate-500">
            <span className="mb-1 block font-medium">{label}</span>
            <input
              type="number"
              min={0}
              value={form[key]}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
            />
          </label>
        ))}
      </div>

      <label className="block text-xs text-slate-500">
        <span className="mb-1 block font-medium">Note (optional)</span>
        <textarea
          value={form.note}
          onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          rows={2}
          className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        />
      </label>

      {error && <ErrorText>{error}</ErrorText>}
      <Button disabled={busy} onClick={() => void submit()}>
        {busy ? "Saving…" : "Save review"}
      </Button>
    </div>
  );
}

// Internal-only supplier scorecard. Scores are computed from recorded reviews.
export function ScorecardPanel({
  vendor,
  canRecord,
  onRecorded,
}: {
  vendor: VendorDetailDTO;
  canRecord: boolean;
  onRecorded: () => void;
}) {
  const [showForm, setShowForm] = useState(false);
  const sc: ScorecardDTO | null = vendor.scorecard;
  if (!sc) return null; // vendor viewer — never rendered

  const latestReview = sc.reviews[0] ?? null;

  return (
    <Card>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Performance scorecard</h2>
        {sc.hasData && sc.band && <Badge tone={bandTone[sc.band]}>{performanceBandLabels[sc.band]}</Badge>}
      </div>

      {sc.hasData ? (
        <>
          <div className="mb-4 flex items-baseline gap-2">
            <span className="text-3xl font-semibold text-slate-900">{sc.overallScore}</span>
            <span className="text-sm text-slate-400">/ 100 · {sc.latestPeriod}</span>
          </div>

          <div className="space-y-3">
            {performanceDimensions.map((d) => (
              <ScoreBar
                key={d}
                label={performanceDimensionLabels[d]}
                value={sc.dimensions[d]}
                weight={performanceWeights[d]}
              />
            ))}
          </div>

          {latestReview && (latestReview.ppm != null || latestReview.otifPercent != null || latestReview.incidents != null) && (
            <div className="mt-4 flex flex-wrap gap-4 border-t border-slate-100 pt-3 text-xs text-slate-600">
              {latestReview.ppm != null && <span>PPM: <strong>{latestReview.ppm}</strong></span>}
              {latestReview.otifPercent != null && <span>OTIF: <strong>{latestReview.otifPercent}%</strong></span>}
              {latestReview.incidents != null && <span>Incidents: <strong>{latestReview.incidents}</strong></span>}
            </div>
          )}

          {sc.trend.length > 1 && (
            <div className="mt-4">
              <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">Trend</p>
              <div className="flex items-end gap-1.5">
                {sc.trend.map((t) => (
                  <div key={t.period} className="flex flex-1 flex-col items-center gap-1" title={`${t.period}: ${t.overallScore}`}>
                    <div className="flex h-16 w-full items-end">
                      <div
                        className={`w-full rounded-t ${t.overallScore < 60 ? "bg-rose-400" : "bg-indigo-400"}`}
                        style={{ height: `${t.overallScore}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-400">{t.period}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-sm text-slate-500">No score yet — record a review to start tracking performance.</p>
      )}

      {canRecord && (
        <div className="mt-4">
          {showForm ? (
            <RecordReviewForm vendorId={vendor.id} onRecorded={() => { setShowForm(false); onRecorded(); }} />
          ) : (
            <Button variant="secondary" onClick={() => setShowForm(true)}>
              {sc.hasData ? "Record new review" : "Record first review"}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}
