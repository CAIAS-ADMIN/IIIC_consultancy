"use client";

import { Info, Calculator } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { YesNoToggle } from "@/components/ui/yes-no-toggle";
import { formatInr } from "@/lib/format";
import { computeFinancialCalculations, emptyPaymentStage, resourceCostTotal, revenueDistributionLines } from "@/lib/wizard/types";
import { Field, MasterDataSelect, RepeatingHeader, RepeatingRow, SectionHeading } from "../field";
import { patchRow, type StepProps } from "../wizard-props";
import { RevenueStatement } from "@/components/records/record-view";

function YesNoField({ label, value, onChange }: { label: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label>{label}</Label>
      <YesNoToggle name={label} value={value} onChange={onChange} />
    </div>
  );
}

export function Step6FinancialsTax({
  state,
  errors,
  masterData,
  updateFinancial,
  updateAgreement,
  updateTeam,
}: StepProps) {
  const f = state.financial;
  const a = state.agreement;
  const members = state.team.members;
  const schedule = f.paymentSchedule;

  // Auto calculations
  // Other Approved Costs = the CAIAS resources listed on the Resources step; they come off the top before the split.
  const resourceCost = String(resourceCostTotal(state.resources));
  const calc = computeFinancialCalculations(f.totalValue, f.taxApplicable, f.taxRatePercent || "18", resourceCost);
  const scheduleTotal = schedule.reduce((sum, row) => sum + (Number(row.plannedAmount) || 0), 0);
  const totalValueNum = Number(f.totalValue) || 0;
  const facultyPoolNum = Number(calc.facultyShareAmount) || 0;
  const shareTotal = members.reduce((sum, m) => sum + (Number(m.contributionPercent) || 0), 0);

  function handleTotalValueChange(val: string) {
    const nextCalc = computeFinancialCalculations(val, f.taxApplicable, f.taxRatePercent || "18", resourceCost);
    updateFinancial({
      totalValue: val,
      taxAmount: nextCalc.taxAmount,
      grossTotalValue: nextCalc.grossTotalValue,
      institutionalSharePercent: nextCalc.institutionalSharePercent,
      institutionalShareAmount: nextCalc.institutionalShareAmount,
      facultySharePercent: nextCalc.facultySharePercent,
      facultyShareAmount: nextCalc.facultyShareAmount,
    });
    updateAgreement({ agreementValue: val });
  }

  function handleTaxToggle(applicable: boolean) {
    const nextCalc = computeFinancialCalculations(f.totalValue, applicable, f.taxRatePercent || "18", resourceCost);
    updateFinancial({
      taxApplicable: applicable,
      taxAmount: nextCalc.taxAmount,
      grossTotalValue: nextCalc.grossTotalValue,
    });
  }

  function handleTaxRateChange(rateStr: string) {
    const nextCalc = computeFinancialCalculations(f.totalValue, f.taxApplicable, rateStr, resourceCost);
    updateFinancial({
      taxRatePercent: rateStr,
      taxAmount: nextCalc.taxAmount,
      grossTotalValue: nextCalc.grossTotalValue,
    });
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <SectionHeading>Consultancy Value & Tax Calculations</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Total Consultancy Value (₹)" htmlFor="total-value" required error={errors.totalValue} className="sm:col-span-2">
            <Input
              id="total-value"
              type="number"
              min="0"
              value={f.totalValue}
              onChange={(e) => handleTotalValueChange(e.target.value)}
              placeholder="e.g. 250000"
            />
          </Field>
          <Field label="Currency" htmlFor="currency" required error={errors.currencyCode}>
            <MasterDataSelect
              id="currency"
              options={masterData.currency ?? []}
              value={f.currencyCode}
              onChange={(v) => updateFinancial({ currencyCode: v })}
              placeholder="Select currency"
            />
          </Field>
          {f.currencyCode === "other" && (
            <Field label="Specify Currency" htmlFor="currency-other" required error={errors.currencyOther}>
              <Input
                id="currency-other"
                value={f.currencyOther}
                onChange={(e) => updateFinancial({ currencyOther: e.target.value })}
                placeholder="e.g. AED"
              />
            </Field>
          )}
          <YesNoField label="Is Tax / GST Applicable?" value={f.taxApplicable} onChange={handleTaxToggle} />
        </div>

        {f.taxApplicable && (
          <div className="grid gap-4 rounded-lg border border-primary/20 bg-primary/5 p-4 sm:grid-cols-3">
            <Field label="Tax Rate (%)" htmlFor="tax-rate" required error={errors.taxRatePercent}>
              <Input
                id="tax-rate"
                type="number"
                min="0"
                max="100"
                value={f.taxRatePercent}
                onChange={(e) => handleTaxRateChange(e.target.value)}
                placeholder="18"
              />
            </Field>
            <div className="flex flex-col gap-1 justify-center">
              <span className="text-xs text-muted-foreground">Calculated Tax Amount</span>
              <span className="text-base font-semibold text-foreground">{formatInr(Number(calc.taxAmount))}</span>
            </div>
            <div className="flex flex-col gap-1 justify-center">
              <span className="text-xs text-muted-foreground">Gross Total (Value + Tax)</span>
              <span className="text-base font-bold text-primary">{formatInr(Number(calc.grossTotalValue))}</span>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" aria-hidden />
          <SectionHeading>Revenue Distribution</SectionHeading>
        </div>
        <p className="text-xs text-muted-foreground">
          Other Approved Costs (the CAIAS resources entered on the Resources &amp; Review step) come off the consultancy value first and are
          reimbursed to the institute. The rest is split: a 40% institutional share when the consultancy value is up to ₹1 Lakh, 20% above
          it; the remainder is the faculty pool.
        </p>

        {Number(f.totalValue) > 0 ? (
          <RevenueStatement head={["", "Amount"]} rows={revenueDistributionLines(calc, f.totalValue, formatInr)} />
        ) : (
          <p className="text-sm text-muted-foreground">Enter the consultancy value above to see the distribution.</p>
        )}

        {members.length > 0 && (
          <div className="flex flex-col gap-3">
            <Label className="text-sm font-semibold">Faculty / Team Member Distribution Share</Label>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Member Name</th>
                    <th className="px-4 py-2 font-medium">Role</th>
                    <th className="px-4 py-2 w-32 font-medium">Pool Share (%)</th>
                    <th className="px-4 py-2 text-right font-medium">Calculated Share Amount (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((m, i) => {
                    const memberSharePct = Number(m.contributionPercent) || 0;
                    const memberAmt = (facultyPoolNum * memberSharePct) / 100;
                    return (
                      <tr key={i} className="hover:bg-background">
                        <td className="px-4 py-2.5 font-medium">{m.name || `Member ${i + 1}`}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">
                          {m.role === "other" && m.roleOther
                            ? m.roleOther
                            : ((masterData.team_role ?? []).find((o) => o.code === m.role)?.label ?? (m.role || "Consultant"))}
                        </td>
                        <td className="px-4 py-2.5">
                          <Input
                            type="number"
                            min="0"
                            max="100"
                            className="h-8 w-24 text-sm"
                            aria-label={`Pool share % for ${m.name || `member ${i + 1}`}`}
                            value={m.contributionPercent}
                            onChange={(e) => updateTeam({ members: patchRow(members, i, { contributionPercent: e.target.value }) })}
                            placeholder="0"
                          />
                        </td>
                        <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatInr(memberAmt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border">
                    <td className="px-4 py-2.5 font-medium" colSpan={2}>
                      Total
                    </td>
                    <td className={shareTotal === 100 ? "px-4 py-2.5 font-semibold text-status-success-fg" : "px-4 py-2.5 font-semibold text-status-danger-fg"}>
                      {shareTotal}%
                    </td>
                    <td className="px-4 py-2.5 text-right font-mono font-semibold">{formatInr((facultyPoolNum * shareTotal) / 100)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4">
        <SectionHeading>Payment Terms & Schedule</SectionHeading>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Payment Structure / Terms" htmlFor="payment-terms" required error={errors.paymentTermsCode}>
            <MasterDataSelect
              id="payment-terms"
              options={masterData.payment_terms ?? []}
              value={a.paymentTermsCode}
              onChange={(v) => updateAgreement({ paymentTermsCode: v })}
              placeholder="Select payment structure"
            />
          </Field>
          {a.paymentTermsCode === "other" && (
            <Field label="Specify Payment Terms" htmlFor="payment-terms-other" required error={errors.paymentTermsOther}>
              <Input id="payment-terms-other" value={a.paymentTermsOther} onChange={(e) => updateAgreement({ paymentTermsOther: e.target.value })} />
            </Field>
          )}
          <Field label="Payment Mode" htmlFor="payment-mode" error={errors.paymentModeCode}>
            <MasterDataSelect
              id="payment-mode"
              options={masterData.payment_mode ?? []}
              value={a.paymentModeCode}
              onChange={(v) => updateAgreement({ paymentModeCode: v })}
              placeholder="Select payment mode"
            />
          </Field>
          {a.paymentModeCode === "other" && (
            <Field label="Specify Payment Mode" htmlFor="payment-mode-other" required error={errors.paymentModeOther}>
              <Input id="payment-mode-other" value={a.paymentModeOther} onChange={(e) => updateAgreement({ paymentModeOther: e.target.value })} />
            </Field>
          )}
        </div>

        <RepeatingHeader
          title="Payment Schedule Breakdown"
          addLabel="Add Payment Stage"
          onAdd={() => updateFinancial({ paymentSchedule: [...schedule, emptyPaymentStage()] })}
          error={errors.paymentSchedule}
        />
        {schedule.map((row, i) => (
          <RepeatingRow
            key={i}
            title={`Stage ${i + 1}`}
            removeLabel={`Remove payment stage ${i + 1}`}
            canRemove={schedule.length > 1}
            onRemove={() => updateFinancial({ paymentSchedule: schedule.filter((_, j) => j !== i) })}
          >
            <Field label="Payment Stage Label" htmlFor={`pay-stage-${i}`} required error={errors[`paymentSchedule.${i}.stageLabel`]}>
              <Input
                id={`pay-stage-${i}`}
                value={row.stageLabel}
                onChange={(e) => updateFinancial({ paymentSchedule: patchRow(schedule, i, { stageLabel: e.target.value }) })}
                placeholder="e.g. 50% Advance"
              />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Amount (₹)" htmlFor={`pay-amount-${i}`} required error={errors[`paymentSchedule.${i}.plannedAmount`]}>
                <Input
                  id={`pay-amount-${i}`}
                  type="number"
                  min="0"
                  value={row.plannedAmount}
                  onChange={(e) => updateFinancial({ paymentSchedule: patchRow(schedule, i, { plannedAmount: e.target.value }) })}
                />
              </Field>
              <Field label="Due Date" htmlFor={`pay-due-${i}`} required error={errors[`paymentSchedule.${i}.plannedDate`]}>
                <Input
                  id={`pay-due-${i}`}
                  type="date"
                  value={row.plannedDate}
                  onChange={(e) => updateFinancial({ paymentSchedule: patchRow(schedule, i, { plannedDate: e.target.value }) })}
                />
              </Field>
            </div>
          </RepeatingRow>
        ))}

        <div className="flex items-center justify-between rounded-md border border-border bg-background p-3 text-sm">
          <span>Schedule Total: <strong>{formatInr(scheduleTotal)}</strong></span>
          <span>Consultancy Value: <strong>{formatInr(totalValueNum)}</strong></span>
          <span className={Math.abs(scheduleTotal - totalValueNum) < 0.01 ? "font-semibold text-status-success-fg" : "font-semibold text-status-danger-fg"}>
            {Math.abs(scheduleTotal - totalValueNum) < 0.01 ? "Matched 100%" : `Mismatch: ${formatInr(scheduleTotal - totalValueNum)}`}
          </span>
        </div>

        <div className="flex gap-3 rounded-lg border border-status-info-fg/30 bg-status-info-bg p-4 text-sm text-status-info-fg">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <p>
            <strong>Institutional Account Compliance Rule:</strong> All consultancy payments must be made to the designated CAIAS institutional account — direct collection by individuals is strictly prohibited under university guidelines.
          </p>
        </div>
      </section>
    </div>
  );
}
