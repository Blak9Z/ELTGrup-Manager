import { ChecklistCategory, ProjectType } from "@prisma/client";

export const defaultChecklistTemplates: {
  name: string;
  category: ChecklistCategory;
  items: string[];
  projectType?: ProjectType;
}[] = [
  {
    name: "Verificare PSI Initiala",
    category: "PSI",
    items: [
      "Verificare trasee de cablu conform plan",
      "Testare butoane incendiu manuale in fiecare zona",
      "Testare sirene de alarma — auditiv si vizual",
      "Verificare detectori de fum (testare laser/calda)",
      "Verificare detectori de temperatura",
      "Testare sistem de stingere (automata / sprinklere)",
      "Verificare centrala de incendiu — starea bateriilor",
      "Testare comunicare centrala — modul GSM/IP",
      "Verificare acte de avizare ISU",
      "Inregistrare raport SNPISU (stare conform/nu conform)",
    ],
  },
  {
    name: "Verificare Electric Initiala",
    category: "ELECTRIC",
    items: [
      "Verificare tabela electrica — etichetare circuite",
      "Testare protectii diferentiale (RCD)",
      "Masurare rezistenta izolatie cabluri",
      "Verificare conexiuni la prize de protectie (PME)",
      "Testare tensiune la bornele principale",
      "Verificare documentatia proiect electric (DPE)",
      "Autorizatie electrica valabila",
    ],
  },
  {
    name: "Verificare BMS Initiala",
    category: "BMS",
    items: [
      "Verificare comunicare cu centrala termica",
      "Testare senzori de temperatura/radiatie",
      "Verificare actionare valve motorizate",
      "Testare istoric date (trenduri) — 24 ore",
      "Verificare regulatoare PID — setpoint-uri",
      "Testare alarme BMS (limite de temperatura)",
      "Verificare integrare cu sistem HVAC",
      "Testare interfata operator (HMI/SCADA)",
    ],
  },
];
