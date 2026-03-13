import Link from "next/link";

export default function HomePage() {
  return (
    <div className="bg-lumen-bg text-slate-100">
      <section
        className="relative h-[65vh] bg-cover bg-center flex items-center justify-center"
        style={{ backgroundImage: "url('/images/hero.png')" }}
      >
        {/* затемнение */}
        <div className="absolute inset-0 bg-black/60 z-10" />

        {/* ЛОГОТИП */}
        <div
        className="absolute w-[1500px] h-[1500px] pointer-events-none"
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

        {/* ТЕКСТ */}
        <div className="relative text-center max-w-xl z-30">
          <h1 className="text-5xl font-bold text-white">
            Протокол «Люмен»
          </h1>

          <p className="mt-4 text-lg text-gray-300">
            Вы были приглашены на D&D-кампейн Авадика Кедаврика.
            <br />
            Прошу прочесть информацию ниже и зарегистрироваться на игру.
          </p>
        </div>
      </section>

      <main className="bg-lumen-bg py-8">
        <div className="mx-auto max-w-7xl px-12">
          <div className="space-y-40">
            <section className="grid grid-cols-1 md:grid-cols-2">
              <div className="text-left">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-4xl font-bold text-lumen-accent">
                  О мире: Вечная ночь Сильвервуда
                </h2>
                <div className="max-w-xl space-y-4 leading-relaxed text-slate-200">
                  <p>Сеттинг: Сурвайвл-хоррор в декорациях темного фэнтези.</p>
                  <p>
                    Более 300 лет назад мир погрузился во Тьму. Единственные очаги жизни — города Коалиции
                    Сильвервуд, зажатые в кольце исполинской тайги и живущие за счет гудящих генераторов и электростанций.
                  </p>
                  <p>
                    Здесь Свет — это не просто удобство, а единственная физическая преграда между вами и голодной
                    материей.
                  </p>
                </div>
              </div>
              <div />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2">
              <div />
              <div className="text-left md:justify-self-end">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-4xl font-bold text-lumen-accent">
                  Ваша роль: Канарейки Пенумбры
                </h2>
                <div className="max-w-xl space-y-4 leading-relaxed text-slate-200">
                  <p>Вы — сотрудники Отдела первичной разведки Бюро «Пенумбра».</p>
                  <p>
                    Официально вас называют «Группами замера и дознания», но в народе прижилось прозвище
                    «Канарейки».
                  </p>
                  <p>
                    Задача:
                    <br />
                    Первыми входить в зоны погасшего света, замерять плотность Тьмы, искать улики и устранять причины
                    инцидентов.
                  </p>
                  <p>
                    Цена:
                    <br />В эту профессию не идут от хорошей жизни.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2">
              <div className="text-left">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-4xl font-bold text-lumen-accent">
                  Главный антагонист: Материя Тьмы
                </h2>
                <div className="max-w-xl space-y-4 leading-relaxed text-slate-200">
                  <p>Тьма в этом мире — не отсутствие света, а хищная физическая субстанция.</p>
                  <p>Она способна давить на психику, вызывать галлюцинации и физически «кусать» плоть.</p>
                  <p>Бюро выделяет 8 категорий плотности — от фоновой тени до монолитного мрака.</p>
                  <p>Чем плотнее мрак, тем выше шанс встретить Фантомов.</p>
                </div>
              </div>
              <div />
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2">
              <div />
              <div className="text-left md:justify-self-end">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-4xl font-bold text-lumen-accent">
                  Ключевые механики выживания
                </h2>
                <ul className="max-w-xl space-y-5 text-slate-200">
                  <li>
                    <p className="font-semibold text-white">Время — это заряд</p>
                    <p className="mt-1 leading-relaxed">Тьма пожирает энергию приборов.</p>
                  </li>
                  <li>
                    <p className="font-semibold text-white">Тенеграф</p>
                    <p className="mt-1 leading-relaxed">Аналоговый прибор, показывающий уровень опасности.</p>
                  </li>
                  <li>
                    <p className="font-semibold text-white">Якоря и спецовки</p>
                    <p className="mt-1 leading-relaxed">Снаряжение Бюро для борьбы с холодом и сущностями.</p>
                  </li>
                  <li>
                    <p className="font-semibold text-white">Протокол изоляции</p>
                    <p className="mt-1 leading-relaxed">Группа решает — спасать упавшего товарища или отступить.</p>
                  </li>
                </ul>
              </div>
            </section>

            <section className="grid grid-cols-1 md:grid-cols-2">
              <div className="text-left">
                <h2 className="mb-6 border-l-4 border-lumen-mid pl-4 text-4xl font-bold text-lumen-accent">
                  Цена выживания
                </h2>
                <div className="max-w-xl space-y-4 leading-relaxed text-slate-200">
                  <p>Бюро ценит сотрудников как государственное имущество.</p>
                  <p>Если тело удастся эвакуировать, врачи вернут вас в строй методами «медицины 60-х».</p>
                  <p>Будьте готовы к последствиям:</p>
                  <ul className="list-disc space-y-1 pl-6">
                    <li>железные протезы</li>
                    <li>светочувствительные линзы</li>
                    <li>зависимость от стимуляторов</li>
                  </ul>
                </div>
              </div>
              <div />
            </section>
          </div>
        </div>

        <section className="mx-auto mt-24 max-w-6xl text-center">
          <Link
            href="/login"
            className="inline-flex items-center rounded-xl bg-lumen-mid px-8 py-4 text-lg font-bold text-white transition hover:bg-lumen-accent"
          >
            Зарегистрироваться
          </Link>
        </section>
      </main>

      <footer className="bg-lumen-bg px-6 py-8 text-center">
        <p className="text-lg font-semibold text-slate-100">Lumen Protocol</p>
        <p className="text-sm text-slate-300">Campaign Portal</p>
        <p className="mt-2 text-xs text-slate-400">D&amp;D Campaign by Avadik Kedavrik</p>
      </footer>
    </div>
  );
}
