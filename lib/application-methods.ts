export const applicationMethodError = "Select Easy apply, Manually applied, or both before saving.";

export function getApplicationMethods(data: FormData) {
  return {
    easyApply: data.get("easyApply") === "true",
    manuallyApplied: data.get("manuallyApplied") === "true",
  };
}
