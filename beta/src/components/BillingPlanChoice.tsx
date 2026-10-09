import { useId } from "react";
export type BillingPlan = "monthly" | "yearly";
export function BillingPlanChoice({
  value,
  onChange,
  disabled = false,
}: {
  value: BillingPlan;
  onChange: (value: BillingPlan) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <fieldset className="billing-plan-choice" disabled={disabled}>
      <legend>Choose a billing period</legend>
      <div className="billing-plan-options">
        {(["monthly", "yearly"] as const).map((plan) => (
          <label key={plan} className={value === plan ? "selected" : ""}>
            <input
              type="radio"
              name={id}
              value={plan}
              checked={value === plan}
              onChange={() => onChange(plan)}
            />
            <span>
              <strong>{plan === "monthly" ? "Monthly" : "Yearly"}</strong>
              <span>
                {plan === "monthly" ? "$5.99 USD / month" : "$59 USD / year"}
              </span>
              <small>
                {plan === "monthly"
                  ? "Billed each month"
                  : "Billed annually · Save $12.88 per year"}
              </small>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
