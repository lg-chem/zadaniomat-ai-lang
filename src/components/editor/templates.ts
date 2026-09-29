export interface DocumentTemplate {
  id: string
  label: string
  description: string
  html: string
}

const taskList = (items: string[]) =>
  `<ul data-type="taskList">${items
    .map((item) => `<li data-type="taskItem" data-checked="false"><p>${item}</p></li>`)
    .join("")}</ul>`

export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    id: "action-plan",
    label: "Plan działania",
    description: "Cel, kroki, terminy i ryzyka",
    html:
      "<h2>Cel</h2><p>Co ma być efektem i po czym poznam, że jest zrobione?</p>" +
      "<h2>Kroki</h2><ol><li><p></p></li><li><p></p></li><li><p></p></li></ol>" +
      "<h2>Ważne daty</h2><table><tbody>" +
      "<tr><th><p>Data</p></th><th><p>Co</p></th></tr>" +
      "<tr><td><p></p></td><td><p></p></td></tr>" +
      "<tr><td><p></p></td><td><p></p></td></tr>" +
      "</tbody></table>" +
      "<h2>Ryzyka i pytania</h2><ul><li><p></p></li></ul>" +
      "<h2>Notatki</h2><p></p>",
  },
  {
    id: "day-plan",
    label: "Plan dnia",
    description: "3 priorytety, bloki czasu, notatki",
    html:
      "<h2>3 najważniejsze rzeczy</h2>" +
      taskList(["", "", ""]) +
      "<h2>Plan godzinowy</h2><table><tbody>" +
      "<tr><th><p>Godzina</p></th><th><p>Co robię</p></th></tr>" +
      "<tr><td><p>08:00</p></td><td><p></p></td></tr>" +
      "<tr><td><p>10:00</p></td><td><p></p></td></tr>" +
      "<tr><td><p>12:00</p></td><td><p></p></td></tr>" +
      "<tr><td><p>14:00</p></td><td><p></p></td></tr>" +
      "<tr><td><p>16:00</p></td><td><p></p></td></tr>" +
      "</tbody></table>" +
      "<h2>Na koniec dnia</h2><p>Co poszło dobrze, co przenoszę na jutro?</p>",
  },
  {
    id: "meeting",
    label: "Notatki ze spotkania",
    description: "Agenda, ustalenia, zadania",
    html:
      "<h2>Uczestnicy</h2><ul><li><p></p></li></ul>" +
      "<h2>Agenda</h2><ol><li><p></p></li></ol>" +
      "<h2>Ustalenia</h2><ul><li><p></p></li></ul>" +
      "<h2>Zadania po spotkaniu</h2>" +
      taskList([""]),
  },
  {
    id: "decision",
    label: "Decyzja / analiza",
    description: "Problem, opcje, decyzja",
    html:
      "<h2>Problem</h2><p></p>" +
      "<h2>Opcje</h2><ol><li><p><strong>Opcja A</strong> – plusy / minusy</p></li><li><p><strong>Opcja B</strong> – plusy / minusy</p></li></ol>" +
      "<h2>Decyzja</h2><p></p>" +
      "<h2>Następne kroki</h2>" +
      taskList([""]),
  },
  {
    id: "checklist",
    label: "Checklista",
    description: "Lista rzeczy do odhaczenia",
    html: taskList(["", "", ""]),
  },
]
