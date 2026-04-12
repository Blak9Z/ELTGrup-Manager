import Image from "next/image";

const jobs = [
  {
    client: "Electropark Logistic",
    location: "Hala B3, Cluj-Napoca",
    job: "Verificare tablou si remediere circuit iluminat",
    team: "Mihai + Andrei",
    status: "In lucru",
    time: "09:30",
  },
  {
    client: "ELTGRUP Service",
    location: "Depozit Oradea",
    job: "Montaj senzori si update raport mentenanta",
    team: "Radu",
    status: "Programat",
    time: "13:00",
  },
  {
    client: "Nord Vest Retail",
    location: "Spatiu comercial, Baia Mare",
    job: "Constatare defect priza trifazata",
    team: "Iulia + Dan",
    status: "Urgent",
    time: "15:45",
  },
];

const modules = [
  "Programari si interventii",
  "Echipe si pontaj",
  "Materiale folosite",
  "Clienti si locatii",
  "Devize si facturi",
  "Rapoarte manageriale",
];

const metrics = [
  ["24", "interventii active"],
  ["8", "echipe pe teren"],
  ["96%", "lucrari cu raport complet"],
  ["18 min", "timp mediu pana la alocare"],
];

const toSlug = (value: string) => value.toLowerCase().replaceAll(" ", "-");

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f8f5] text-[#172019]">
      <section className="relative grid min-h-screen grid-cols-1 lg:grid-cols-[300px_1fr]">
        <aside className="border-b border-[#dfe7dd] bg-white/92 px-5 py-5 backdrop-blur lg:border-b-0 lg:border-r">
          <div className="flex items-center gap-3">
            <div className="grid size-11 place-items-center rounded-md bg-[#0d6b3f] text-sm font-black text-white">
              ETL
            </div>
            <div>
              <p className="text-sm font-bold uppercase tracking-normal text-[#0d6b3f]">
                ELTGRUP
              </p>
              <p className="text-xl font-black tracking-normal">
                Manager
              </p>
            </div>
          </div>

          <nav className="mt-8 grid gap-2 text-sm font-semibold text-[#526052]">
            {modules.map((module) => (
              <a
                className="rounded-md px-3 py-3 transition hover:bg-[#eef4ed] hover:text-[#172019]"
                href={`#module-${toSlug(module)}`}
                key={module}
              >
                {module}
              </a>
            ))}
          </nav>

          <div className="mt-8 rounded-md border border-[#cbd8c8] bg-[#f8fbf7] p-4">
            <p className="text-xs font-bold uppercase tracking-normal text-[#0d6b3f]">
              Tura curenta
            </p>
            <p className="mt-3 text-3xl font-black">6/8</p>
            <p className="mt-1 text-sm leading-6 text-[#5e6b5e]">
              echipe au confirmat sosirea in locatie si au pornit pontajul.
            </p>
          </div>
        </aside>

        <div className="relative">
          <header className="flex flex-wrap items-center justify-between gap-4 border-b border-[#dfe7dd] bg-white/88 px-5 py-4 backdrop-blur md:px-8">
            <div>
              <p className="text-sm font-bold uppercase tracking-normal text-[#0d6b3f]">
                ETL GRUP Manager
              </p>
              <h1 className="text-2xl font-black tracking-normal text-[#172019] md:text-3xl">
                Comanda, teren si financiar intr-un singur flux.
              </h1>
            </div>
            <a
              className="rounded-md bg-[#0d6b3f] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#094d2f]"
              href="#programari-si-interventii"
            >
              Deschide planificarea
            </a>
          </header>

          <div className="grid gap-6 px-5 py-6 md:px-8 xl:grid-cols-[1fr_380px]">
            <section className="grid gap-6">
              <div className="relative min-h-[520px] overflow-hidden rounded-md border border-[#cbd8c8] bg-[#172019] text-white">
                <Image
                  alt="Electrician inspecting an industrial circuit panel"
                  className="absolute inset-0 h-full w-full object-cover opacity-[0.34]"
                  fill
                  priority
                  sizes="(min-width: 1280px) 62vw, 100vw"
                  src="https://images.pexels.com/photos/34054475/pexels-photo-34054475.jpeg"
                />
                <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(23,32,25,0.96),rgba(23,32,25,0.68),rgba(23,32,25,0.24))]" />
                <div className="relative flex min-h-[520px] flex-col justify-between p-5 md:p-8">
                  <div className="max-w-3xl">
                    <p className="inline-flex rounded-md bg-white/12 px-3 py-2 text-sm font-bold text-[#d8f4b7] ring-1 ring-white/18">
                      Operatiuni electrice, service si mentenanta
                    </p>
                    <h2 className="mt-6 max-w-4xl text-4xl font-black leading-tight tracking-normal md:text-6xl">
                      Planifica lucrari, aloca echipe si inchide rapoarte direct din teren.
                    </h2>
                    <p className="mt-6 max-w-2xl text-lg leading-8 text-[#e9f1e7]">
                      Fiecare comanda are locatie, echipa, materiale, fotografii,
                      timp lucrat, semnatura clientului si status financiar.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-4">
                    {metrics.map(([value, label]) => (
                      <div
                        className="rounded-md border border-white/16 bg-white/10 p-4 backdrop-blur"
                        key={label}
                      >
                        <p className="text-3xl font-black">{value}</p>
                        <p className="mt-1 text-sm text-[#dbe5d8]">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <section
                className="grid gap-4 md:grid-cols-3"
                id="programari-si-interventii"
              >
                {jobs.map((job) => (
                  <article
                    className="rounded-md border border-[#d8e2d5] bg-white p-5 shadow-sm"
                    key={`${job.client}-${job.time}`}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-black text-[#0d6b3f]">
                        {job.time}
                      </p>
                      <span className="rounded-md bg-[#eef4ed] px-2.5 py-1 text-xs font-bold text-[#34513d]">
                        {job.status}
                      </span>
                    </div>
                    <h3 className="mt-4 text-xl font-black">{job.client}</h3>
                    <p className="mt-1 text-sm font-semibold text-[#5b675c]">
                      {job.location}
                    </p>
                    <p className="mt-4 min-h-16 text-sm leading-6 text-[#485449]">
                      {job.job}
                    </p>
                    <p className="mt-5 rounded-md bg-[#f3f7f2] px-3 py-2 text-sm font-bold text-[#172019]">
                      Echipa: {job.team}
                    </p>
                  </article>
                ))}
              </section>
            </section>

            <section className="grid content-start gap-6">
              <div className="rounded-md border border-[#d8e2d5] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-normal text-[#0d6b3f]">
                  Flux comanda
                </p>
                <div className="mt-5 grid gap-4">
                  {[
                    "Cerere primita",
                    "Deviz aprobat",
                    "Echipa alocata",
                    "Raport semnat",
                    "Factura trimisa",
                  ].map((step, index) => (
                    <div className="flex items-center gap-3" key={step}>
                      <span className="grid size-8 place-items-center rounded-md bg-[#0d6b3f] text-sm font-black text-white">
                        {index + 1}
                      </span>
                      <p className="font-bold text-[#263128]">{step}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-md border border-[#d8e2d5] bg-[#eaf3e6] p-5 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-normal text-[#0d6b3f]">
                  Control manager
                </p>
                <h2 className="mt-4 text-3xl font-black leading-tight">
                  Vezi pierderile inainte sa ajunga in factura.
                </h2>
                <p className="mt-4 leading-7 text-[#4b584b]">
                  Timp nealocat, materiale lipsa, lucrari fara poza si rapoarte
                  nesemnate apar in lista de actiuni a coordonatorului.
                </p>
              </div>

              <div className="rounded-md border border-[#d8e2d5] bg-white p-5 shadow-sm">
                <p className="text-sm font-bold uppercase tracking-normal text-[#0d6b3f]">
                  Module incluse
                </p>
                <div className="mt-4 grid gap-3">
                  {modules.map((module) => (
                    <div
                      className="flex items-center justify-between rounded-md bg-[#f7faf6] px-3 py-3 text-sm font-bold"
                      id={`module-${toSlug(module)}`}
                      key={module}
                    >
                      <span>{module}</span>
                      <span className="text-[#0d6b3f]">activ</span>
                    </div>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </section>
    </main>
  );
}
