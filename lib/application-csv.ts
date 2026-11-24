type ExportEntry = {
  role: string; company: string; url: string; salary: string | null;
  status: string; easyApply: boolean; manuallyApplied: boolean;
  notes: string | null; cvName: string; letterName: string; createdAt: string;
};

function cell(value: string | null) {
  let text = value ?? "";
  // Keep application text from being evaluated as a spreadsheet formula.
  if (/^\s*[=+\-@\t\r\n]/.test(text)) text = "'" + text;
  return `"${text.replaceAll('"', '""')}"`;
}

export function applicationCsv(username: string, entries: ExportEntry[]) {
  const rows = [
    ["Username", "Job title", "Company", "Job link", "Salary requirement", "Status", "Easy apply", "Manually applied", "Notes", "CV filename", "Cover letter filename", "Added"],
    ...entries.map(entry => [username, entry.role, entry.company, entry.url, entry.salary, entry.status, entry.easyApply ? "Yes" : "No", entry.manuallyApplied ? "Yes" : "No", entry.notes, entry.cvName, entry.letterName, entry.createdAt]),
  ];
  return "\uFEFF" + rows.map(row => row.map(cell).join(",")).join("\r\n") + "\r\n";
}
