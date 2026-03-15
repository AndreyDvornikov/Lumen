import Link from "next/link";

export default function HomePage() {
  return (
    <div className="bg-lumen-bg text-slate-100">
      <section
        className="relative flex min-h-[60vh] items-center justify-center overflow-hidden bg-cover bg-center px-4 py-16 sm:min-h-[65vh] sm:px-6"
        style={{ backgroundImage: "url('/images/hero.png')" }}
      >
        <div className="absolute inset-0 bg-black/60 z-10" />

        <div
          className="absolute pointer-events-none h-[min(1500px,140vw)] w-[min(1500px,140vw)]"
          style={{
            WebkitMaskImage: "url('/logo.svg')",
            maskImage: "url('/logo.svg')",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
            backdropFilter: "blur(8px) brightness(1.4) contrast(1.2)",
            WebkitBackdropFilter: "blur(8px) brightness(1.4) contrast(1.2)",
            background: "rgba(255,255,255,0.18)"
          }}
        />

        <div className="relative z-30 mx-auto w-full max-w-xl px-2 text-center">
          <h1 className="text-[clamp(2.5rem,8vw,3.75rem)] font-bold leading-tight text-white">
            Протокол «Люмен»
          </h1>

          <p className="mt-4 text-[clamp(1rem,3.8vw,1.125rem)] text-gray-300">
            Внутренний портал Бюро «Пенумбра».
          </p>

          <p className="mt-2 text-sm leading-relaxed text-gray-400 sm:text-base">
            Если вы получили доступ к этому ресурсу — значит ваше имя
            было рекомендовано для участия в программе первичной разведки.
          </p>
        </div>
      </section>

      <main className="bg-lumen-bg py-8">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-20 sm:space-y-28 lg:space-y-40">

            <section className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
              <div className="text-left">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-[clamp(1.875rem,6vw,2.25rem)] font-bold leading-tight text-lumen-accent">
                  Ситуация в мире
                </h2>
                <div className="max-w-xl space-y-4 break-words leading-relaxed text-slate-200">
                  <p>
                    Более трёх столетий назад человечество столкнулось с явлением,
                    получившим рабочее название <span className="text-white font-semibold">Материя Тьмы</span>.
                  </p>

                  <p>
                    С тех пор большая часть планеты остаётся непригодной для жизни.
                    Единственные стабильные территории — города Коалиции Сильвервуд.
                  </p>

                  <p>
                    Они существуют благодаря массивным электростанциям и
                    непрерывной генерации света.
                  </p>

                  <p>
                    Свет здесь — не удобство.  
                    Свет — это единственная физическая преграда
                    между человеком и Тьмой.
                  </p>
                </div>
              </div>
              <div />
            </section>

            <section className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
              <div />
              <div className="text-left md:justify-self-end">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-[clamp(1.875rem,6vw,2.25rem)] font-bold leading-tight text-lumen-accent">
                  Бюро «Пенумбра»
                </h2>
                <div className="max-w-xl space-y-4 break-words leading-relaxed text-slate-200">
                  <p>
                    Бюро «Пенумбра» занимается изучением Тьмы и всеми инцидентами,
                    связанными с её проявлениями.
                  </p>

                  <p>
                    Отдел первичной разведки действует там,
                    где обычные службы больше не работают.
                  </p>

                  <p>
                    Разведгруппы первыми входят в зоны,
                    где погас свет.
                  </p>

                  <p>
                    Их задачи могут включать восстановление энергосистем,
                    эвакуацию выживших, расследование инцидентов,
                    поиск пропавших объектов и экспедиции
                    в давно покинутые города.
                  </p>

                  <p>
                    В неофициальной речи сотрудников называют
                    <span className="text-white font-semibold"> «Канарейками»</span>.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
              <div className="text-left">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-[clamp(1.875rem,6vw,2.25rem)] font-bold leading-tight text-lumen-accent">
                  Материя Тьмы
                </h2>
                <div className="max-w-xl space-y-4 break-words leading-relaxed text-slate-200">
                  <p>
                    Тьма не является отсутствием света.
                  </p>

                  <p>
                    Это агрессивная физическая субстанция,
                    способная взаимодействовать с человеческой психикой
                    и биологической тканью.
                  </p>

                  <p>
                    При высоких уровнях плотности фиксируются
                    проявления сущностей, условно обозначенных как
                    <span className="text-white font-semibold"> Фантомы</span>.
                  </p>

                  <p>
                    Стандартная классификация Бюро выделяет
                    восемь уровней плотности Тьмы —
                    от фоновой тени до монолитного мрака.
                  </p>
                </div>
              </div>
              <div />
            </section>

            <section className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
              <div />
              <div className="text-left md:justify-self-end">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-[clamp(1.875rem,6vw,2.25rem)] font-bold leading-tight text-lumen-accent">
                  Работа разведгруппы
                </h2>
                <ul className="max-w-xl space-y-5 break-words text-slate-200">
                  <li>
                    <p className="font-semibold text-white">Разведка погасших зон</p>
                    <p className="mt-1 leading-relaxed">
                      Вход в области, где перестали функционировать источники света.
                    </p>
                  </li>

                  <li>
                    <p className="font-semibold text-white">Поиск и эвакуация людей</p>
                    <p className="mt-1 leading-relaxed">
                      Спасение персонала и гражданских из зон высокой плотности Тьмы.
                    </p>
                  </li>

                  <li>
                    <p className="font-semibold text-white">Расследование инцидентов</p>
                    <p className="mt-1 leading-relaxed">
                      Выяснение причин исчезновения людей,
                      аварий энергосетей и аномальных событий.
                    </p>
                  </li>

                  <li>
                    <p className="font-semibold text-white">Экспедиции</p>
                    <p className="mt-1 leading-relaxed">
                      Выходы за пределы городов Коалиции
                      и исследование погасших населённых пунктов.
                    </p>
                  </li>
                </ul>
              </div>
            </section>

            <section className="grid grid-cols-1 gap-8 md:grid-cols-2 md:gap-12">
              <div className="text-left">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-[clamp(1.875rem,6vw,2.25rem)] font-bold leading-tight text-lumen-accent">
                  Риски службы
                </h2>
                <div className="max-w-xl space-y-4 break-words leading-relaxed text-slate-200">
                  <p>
                    Работа в разведгруппах считается одной из самых опасных
                    профессий в городах Коалиции.
                  </p>

                  <p>
                    Большинство сотрудников проводят во Тьме
                    больше времени, чем допускают официальные нормы.
                  </p>

                  <p>
                    Бюро ценит своих специалистов и старается
                    возвращать их в строй, даже после тяжёлых ранений.
                  </p>

                  <p>
                    Однако служба редко проходит без последствий.
                  </p>
                </div>
              </div>
              <div />
            </section>

          </div>
        </div>

        <section className="mx-auto mt-16 w-full max-w-3xl space-y-6 px-4 text-center sm:mt-24 sm:px-6">

          <p className="text-xs uppercase tracking-widest text-lumen-accent">
            БЮРО ПЕНУМБРА
          </p>

          <p className="text-base leading-relaxed text-slate-200 sm:text-lg">
            Если вы получили доступ к этой странице,
            значит ваше имя было рекомендовано для участия
            в программе первичной разведки.
          </p>

          <p className="text-slate-400">
            Перед началом службы необходимо заполнить анкету кандидата.
          </p>

          <a
            href="https://forms.gle/35kK9nT3k5vjGc586"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex w-full items-center justify-center rounded-xl bg-lumen-mid px-6 py-4 text-base font-bold text-white transition hover:bg-lumen-accent sm:w-auto sm:px-8 sm:text-lg"
          >
            Подать заявку в Пенумбру
          </a>

          <p className="text-xs text-slate-500">
            После обработки анкеты вам будет выдан доступ
            к серверу кампании.
          </p>

        </section>
      </main>

      <footer className="bg-lumen-bg px-6 py-8 text-center">
        <p className="text-lg font-semibold text-slate-100">Lumen Protocol</p>
        <p className="text-sm text-slate-300">Internal Portal</p>
        <p className="mt-2 text-xs text-slate-400">
          Bureau Penumbra · Silverwood Coalition
        </p>
      </footer>
    </div>
  );
}
