// Step-by-step lessons for schools and universities. Facts only from sources already verified for this project
// (DOIs below) or from this model's own results (docs/MODEL_NOTES.md, tools/calibrate/results/).
// Kazakh text needs review by a native speaker.
import type { Lang } from '../i18n';

export type Text = Record<Lang, string>;

export interface Step {
  text: Text;
  /** lab URL (path + query) that shows this step live */
  demo?: string;
}

export interface Question {
  q: Text;
  options: Text[];
  answer: number;
  why: Text;
}

export interface Lesson {
  id: string;
  title: Text;
  summary: Text;
  steps: Step[];
  quiz: Question[];
  sources: Array<{ cite: string; doi?: string; file?: string }>;
}

const SHIU = { cite: 'Shiu et al., Nature 2024', doi: '10.1038/s41586-024-07763-9' };
const FLYWIRE = { cite: 'Dorkenwald et al., Nature 2024', doi: '10.1038/s41586-024-07558-y' };
const ZHENG = { cite: 'Zheng et al., Cell 2018', doi: '10.1016/j.cell.2018.06.019' };

export const LESSONS: Lesson[] = [
  {
    id: 'neuron',
    title: { en: 'What is a neuron?', ru: 'Что такое нейрон?', kk: 'Нейрон деген не?' },
    summary: {
      en: 'Spikes, thresholds and synapses — the parts every neuron in this lab is made of.',
      ru: 'Спайки, порог и синапсы — из чего сделан каждый нейрон в этой лаборатории.',
      kk: 'Спайктар, шек және синапстар — осы зертханадағы әр нейрон неден құралған.',
    },
    steps: [
      {
        text: {
          en: 'A neuron is a cell that passes signals. It collects input from other neurons through synapses and, when the input is strong enough, fires a short electrical pulse — a spike. The fly brain mapped by FlyWire has 139,255 neurons.',
          ru: 'Нейрон — это клетка, которая передаёт сигналы. Он собирает входы от других нейронов через синапсы и, когда вход достаточно сильный, выдаёт короткий электрический импульс — спайк. В мозге мухи, картированном FlyWire, 139 255 нейронов.',
          kk: 'Нейрон — сигнал беретін жасуша. Ол басқа нейрондардан синапстар арқылы кіріс жинайды және кіріс жеткілікті күшті болса, қысқа электр импульсін — спайк шығарады. FlyWire картаға түсірген шыбын миында 139 255 нейрон бар.',
        },
      },
      {
        text: {
          en: 'In this lab each neuron is a simple “leaky integrate-and-fire” model, as in Shiu et al. 2024: its voltage rests at −52 mV, inputs push it up, it slowly leaks back, and when it reaches −45 mV it fires a spike and resets.',
          ru: 'В этой лаборатории каждый нейрон — простая модель «интегрировать и сработать с утечкой», как у Shiu et al. 2024: напряжение покоя −52 мВ, входы поднимают его, оно медленно стекает обратно, а при −45 мВ нейрон даёт спайк и сбрасывается.',
          kk: 'Бұл зертханада әр нейрон Shiu et al. 2024 жұмысындағыдай қарапайым «ағып кету-жинақтау-іске қосылу» моделі: тыныштық кернеуі −52 мВ, кірістер оны көтереді, ол баяу қайта төмендейді, ал −45 мВ-қа жеткенде нейрон спайк шығарып, қалпына келеді.',
        },
      },
      {
        text: {
          en: 'The strength of a connection is the number of synapses between two neurons, read from the FlyWire wiring diagram. Each synapse adds 0.275 mV — the one number Shiu et al. tuned. Some neurons are inhibitory: their spikes push the voltage down instead of up.',
          ru: 'Сила связи — это число синапсов между двумя нейронами из схемы FlyWire. Каждый синапс добавляет 0,275 мВ — единственное число, которое подбирали Shiu et al. Некоторые нейроны тормозные: их спайки не поднимают, а опускают напряжение.',
          kk: 'Байланыс күші — FlyWire сызбасындағы екі нейрон арасындағы синапс саны. Әр синапс 0,275 мВ қосады — Shiu et al. таңдаған жалғыз сан. Кейбір нейрондар тежегіш: олардың спайктары кернеуді көтермей, төмендетеді.',
        },
      },
      {
        text: {
          en: 'Try it: give the fly sugar, then click any dot in the 3D brain. The inspector shows that neuron’s cell type and its strongest inputs and outputs.',
          ru: 'Попробуйте: дайте мухе сахар и кликните любую точку в 3D-мозге. Инспектор покажет тип этого нейрона и его самые сильные входы и выходы.',
          kk: 'Байқап көріңіз: шыбынға қант беріп, 3D мидағы кез келген нүктені басыңыз. Инспектор сол нейронның түрін және ең күшті кірістері мен шығыстарын көрсетеді.',
        },
        demo: '/?s=sugar:150',
      },
    ],
    quiz: [
      {
        q: { en: 'When does a model neuron fire a spike?', ru: 'Когда нейрон модели даёт спайк?', kk: 'Модель нейроны қашан спайк шығарады?' },
        options: [
          { en: 'When its voltage reaches the threshold (−45 mV)', ru: 'Когда напряжение достигает порога (−45 мВ)', kk: 'Кернеуі шекке (−45 мВ) жеткенде' },
          { en: 'Every second, on a timer', ru: 'Каждую секунду, по таймеру', kk: 'Әр секунд сайын, таймер бойынша' },
          { en: 'After any single synapse', ru: 'После любого одного синапса', kk: 'Кез келген бір синапстан кейін' },
        ],
        answer: 0,
        why: {
          en: 'Inputs add up; only when the voltage crosses −45 mV does the neuron spike.',
          ru: 'Входы складываются; спайк возникает только когда напряжение пересекает −45 мВ.',
          kk: 'Кірістер қосылады; кернеу −45 мВ-тан асқанда ғана спайк пайда болады.',
        },
      },
      {
        q: { en: 'What sets how strong a connection is in this model?', ru: 'Что задаёт силу связи в этой модели?', kk: 'Бұл модельде байланыс күшін не анықтайды?' },
        options: [
          { en: 'The number of synapses between the two neurons', ru: 'Число синапсов между двумя нейронами', kk: 'Екі нейрон арасындағы синапс саны' },
          { en: 'The distance between them', ru: 'Расстояние между ними', kk: 'Олардың арасындағы қашықтық' },
          { en: 'A random number', ru: 'Случайное число', kk: 'Кездейсоқ сан' },
        ],
        answer: 0,
        why: {
          en: 'Weights are synapse counts from FlyWire times 0.275 mV.',
          ru: 'Веса — это числа синапсов из FlyWire, умноженные на 0,275 мВ.',
          kk: 'Салмақтар — FlyWire синапс сандары, 0,275 мВ-қа көбейтілген.',
        },
      },
    ],
    sources: [FLYWIRE, SHIU],
  },
  {
    id: 'receptors',
    title: { en: 'Senses: receptor neurons', ru: 'Чувства: рецепторные нейроны', kk: 'Сезім: рецептор нейрондар' },
    summary: {
      en: 'How taste turns into spikes, and why bitter stops feeding.',
      ru: 'Как вкус превращается в спайки и почему горькое останавливает питание.',
      kk: 'Дәм спайкқа қалай айналады және ащы неге қоректенуді тоқтатады.',
    },
    steps: [
      {
        text: {
          en: 'The brain learns about the world through sensory neurons. Each kind responds to one thing: sugar, bitter, a shadow overhead, wind moving the antenna.',
          ru: 'Мозг узнаёт о мире через сенсорные нейроны. Каждый вид реагирует на что-то одно: сахар, горькое, тень сверху, ветер, двигающий антенну.',
          kk: 'Ми әлем туралы сенсорлық нейрондар арқылы біледі. Әр түрі бір нәрсеге жауап береді: қант, ащы, үстіндегі көлеңке, мұртшаны қозғайтын жел.',
        },
      },
      {
        text: {
          en: 'In this lab a stimulus means: make those receptor neurons fire at a set rate. Shiu et al. did the same with sugar taste neurons; the “Sugar” button uses their list (20 of their neurons are in the current FlyWire release).',
          ru: 'В этой лаборатории стимул означает: заставить эти рецепторные нейроны срабатывать с заданной частотой. Shiu et al. делали так же с сахарными вкусовыми нейронами; кнопка «Сахар» использует их список (20 их нейронов есть в текущем выпуске FlyWire).',
          kk: 'Бұл зертханада тітіркендіргіш дегеніміз — сол рецептор нейрондарын белгілі жиілікпен іске қосу. Shiu et al. қант дәм нейрондарымен солай істеген; «Қант» батырмасы олардың тізімін пайдаланады (олардың 20 нейроны FlyWire-дың қазіргі шығарылымында бар).',
        },
      },
      {
        text: {
          en: 'Sugar makes MN9 fire — the motor neuron of the proboscis — and the fly extends its proboscis. Add bitter at the same time and MN9 drops (in our runs from about 77 to 8.5 Hz): bitter suppresses feeding, as Shiu et al. found.',
          ru: 'Сахар заставляет срабатывать MN9 — мотонейрон хоботка, — и муха выдвигает хоботок. Добавьте одновременно горькое — и MN9 падает (в наших прогонах примерно с 77 до 8,5 Гц): горькое подавляет питание, как и у Shiu et al.',
          kk: 'Қант MN9-ды — тұмсықшаның қозғалтқыш нейронын — іске қосады, және шыбын тұмсықшасын шығарады. Бір уақытта ащыны қосыңыз — MN9 төмендейді (біздің есептеулерде шамамен 77-ден 8,5 Гц-ке дейін): Shiu et al. тапқандай, ащы қоректенуді басады.',
        },
        demo: '/?s=sugar:150,bitter:150',
      },
      {
        text: {
          en: 'Some senses do nothing here. Shiu et al. reported that water receptors drive feeding, but with the current annotations this model does not reproduce it — so the lab says “the model does not reproduce this” instead of faking it.',
          ru: 'Некоторые чувства здесь ничего не делают. Shiu et al. сообщали, что рецепторы воды запускают питание, но с текущими аннотациями модель этого не воспроизводит — и лаборатория так и пишет, а не подделывает реакцию.',
          kk: 'Кейбір сезімдер мұнда ештеңе істемейді. Shiu et al. су рецепторлары қоректенуді іске қосатынын хабарлаған, бірақ қазіргі аннотациялармен модель оны қайталамайды — зертхана реакцияны жасанды жасамай, соны ашық жазады.',
        },
        demo: '/?s=water:150',
      },
    ],
    quiz: [
      {
        q: { en: 'What is a stimulus in this lab?', ru: 'Что такое стимул в этой лаборатории?', kk: 'Бұл зертханада тітіркендіргіш деген не?' },
        options: [
          { en: 'Receptor neurons are made to fire', ru: 'Рецепторные нейроны заставляют срабатывать', kk: 'Рецептор нейрондарын іске қосу' },
          { en: 'A script moves the fly', ru: 'Скрипт двигает муху', kk: 'Скрипт шыбынды қозғайды' },
          { en: 'The fly is shown a picture', ru: 'Мухе показывают картинку', kk: 'Шыбынға сурет көрсетіледі' },
        ],
        answer: 0,
        why: {
          en: 'Everything the fly does follows from receptor spikes travelling through the wiring.',
          ru: 'Всё, что делает муха, следует из спайков рецепторов, бегущих по схеме связей.',
          kk: 'Шыбынның бар әрекеті байланыс сызбасы бойымен жүретін рецептор спайктарынан туады.',
        },
      },
      {
        q: { en: 'What happens when bitter is added to sugar?', ru: 'Что происходит, если к сахару добавить горькое?', kk: 'Қантқа ащыны қосса не болады?' },
        options: [
          { en: 'MN9 fires much less and feeding stops', ru: 'MN9 срабатывает гораздо реже, питание прекращается', kk: 'MN9 әлдеқайда сирек іске қосылып, қоректену тоқтайды' },
          { en: 'The fly feeds faster', ru: 'Муха ест быстрее', kk: 'Шыбын тезірек жейді' },
          { en: 'Nothing changes', ru: 'Ничего не меняется', kk: 'Ештеңе өзгермейді' },
        ],
        answer: 0,
        why: {
          en: 'Bitter neurons inhibit the feeding pathway: MN9 drops from about 77 to 8.5 Hz in this model.',
          ru: 'Горькие нейроны тормозят путь питания: в модели MN9 падает примерно с 77 до 8,5 Гц.',
          kk: 'Ащы нейрондары қоректену жолын тежейді: модельде MN9 шамамен 77-ден 8,5 Гц-ке түседі.',
        },
      },
    ],
    sources: [SHIU, { cite: 'Model results', file: 'docs/MODEL_NOTES.md §5' }],
  },
  {
    id: 'pathway',
    title: { en: 'A signal’s path: from shadow to escape', ru: 'Путь сигнала: от тени до побега', kk: 'Сигнал жолы: көлеңкеден қашуға дейін' },
    summary: {
      en: 'Follow one reflex from the eye to the body.',
      ru: 'Проследите один рефлекс от глаза до тела.',
      kk: 'Бір рефлексті көзден денеге дейін қадағалаңыз.',
    },
    steps: [
      {
        text: {
          en: 'A dark shadow growing above the fly (“looming”) excites visual neurons of the types LC4 and LPLC2 — 314 neurons in this model.',
          ru: 'Тёмная тень, растущая над мухой («надвигание»), возбуждает зрительные нейроны типов LC4 и LPLC2 — 314 нейронов в этой модели.',
          kk: 'Шыбынның үстінде үлкейіп келе жатқан қараңғы көлеңке LC4 және LPLC2 түріндегі көру нейрондарын қоздырады — бұл модельде 314 нейрон.',
        },
      },
      {
        text: {
          en: 'Their spikes reach the Giant Fiber (cell type DNp01), a large descending neuron that runs from the brain to the body. In the model it fires at around 260 Hz.',
          ru: 'Их спайки доходят до гигантского волокна (тип DNp01) — крупного нисходящего нейрона, идущего из мозга в тело. В модели оно срабатывает примерно с частотой 260 Гц.',
          kk: 'Олардың спайктары алып талшыққа (DNp01 түрі) жетеді — мидан денеге түсетін ірі төмендеуші нейрон. Модельде ол шамамен 260 Гц жиілікпен іске қосылады.',
        },
      },
      {
        text: {
          en: 'In real flies the Giant Fiber triggers a fast takeoff in response to looming (von Reyn et al. 2014). The lab shows a jump only while the Giant Fiber fires above 50 Hz.',
          ru: 'У настоящих мух гигантское волокно запускает быстрый взлёт в ответ на надвигание (von Reyn et al. 2014). Лаборатория показывает прыжок, только пока волокно срабатывает чаще 50 Гц.',
          kk: 'Нағыз шыбындарда алып талшық жақындаған көлеңкеге жауап ретінде жылдам ұшуды іске қосады (von Reyn et al. 2014). Зертхана секіруді тек талшық 50 Гц-тен жиі іске қосылғанда көрсетеді.',
        },
        demo: '/?s=looming:150',
      },
      {
        text: {
          en: 'Open the “Signal path” panel in the lab: receptor → processing → descending neuron → action, each lit by its live rate. The sugar reflex has the same shape: taste neurons → GNG (the region under the oesophagus) → MN9 → proboscis.',
          ru: 'Откройте в лаборатории панель «Путь сигнала»: рецептор → обработка → нисходящий нейрон → действие, каждое звено подсвечено живой частотой. У сахарного рефлекса та же форма: вкусовые нейроны → GNG (область под пищеводом) → MN9 → хоботок.',
          kk: 'Зертханада «Сигнал жолы» панелін ашыңыз: рецептор → өңдеу → төмендеуші нейрон → әрекет, әр буын нақты жиілікпен жанады. Қант рефлексінің пішіні де сондай: дәм нейрондары → GNG (өңеш астындағы аймақ) → MN9 → тұмсықша.',
        },
        demo: '/?s=sugar:150',
      },
    ],
    quiz: [
      {
        q: { en: 'Which neuron triggers the escape in this model?', ru: 'Какой нейрон запускает побег в этой модели?', kk: 'Бұл модельде қашуды қай нейрон іске қосады?' },
        options: [
          { en: 'The Giant Fiber (DNp01)', ru: 'Гигантское волокно (DNp01)', kk: 'Алып талшық (DNp01)' },
          { en: 'MN9', ru: 'MN9', kk: 'MN9' },
          { en: 'A Kenyon cell', ru: 'Клетка Кеньона', kk: 'Кеньон жасушасы' },
        ],
        answer: 0,
        why: {
          en: 'The escape is shown only while the Giant Fiber fires above 50 Hz.',
          ru: 'Побег показывается, только пока гигантское волокно срабатывает чаще 50 Гц.',
          kk: 'Қашу тек алып талшық 50 Гц-тен жиі іске қосылғанда көрсетіледі.',
        },
      },
      {
        q: { en: 'What starts this reflex?', ru: 'Что запускает этот рефлекс?', kk: 'Бұл рефлексті не іске қосады?' },
        options: [
          { en: 'A shadow growing above the fly', ru: 'Тень, растущая над мухой', kk: 'Шыбын үстінде үлкейетін көлеңке' },
          { en: 'Sugar', ru: 'Сахар', kk: 'Қант' },
          { en: 'Cold air', ru: 'Холодный воздух', kk: 'Суық ауа' },
        ],
        answer: 0,
        why: {
          en: 'Looming excites LC4 and LPLC2 visual neurons, which drive the Giant Fiber.',
          ru: 'Надвигание возбуждает зрительные нейроны LC4 и LPLC2, а они — гигантское волокно.',
          kk: 'Жақындау LC4 және LPLC2 көру нейрондарын қоздырады, ал олар алып талшықты іске қосады.',
        },
      },
    ],
    sources: [{ cite: 'von Reyn et al., Nat. Neurosci. 2014', doi: '10.1038/nn.3741' }, SHIU, { cite: 'Model results', file: 'docs/MODEL_NOTES.md §5' }],
  },
  {
    id: 'memory',
    title: { en: 'Memory and the mushroom bodies', ru: 'Память и грибовидные тела', kk: 'Жад және саңырауқұлақ денелер' },
    summary: {
      en: 'Where flies learn — and why this model cannot.',
      ru: 'Где мухи учатся — и почему эта модель не может.',
      kk: 'Шыбындар қайда үйренеді — және бұл модель неге үйрене алмайды.',
    },
    steps: [
      {
        text: {
          en: 'Flies can learn. A brain region called the mushroom body has been studied extensively for its role in learning (Zheng et al. 2018). Its own neurons are called Kenyon cells.',
          ru: 'Мухи умеют учиться. Область мозга, называемая грибовидным телом, подробно изучена из-за её роли в обучении (Zheng et al. 2018). Её собственные нейроны называются клетками Кеньона.',
          kk: 'Шыбындар үйрене алады. Саңырауқұлақ дене деп аталатын ми аймағы үйренудегі рөлі үшін жан-жақты зерттелген (Zheng et al. 2018). Оның өз нейрондары Кеньон жасушалары деп аталады.',
        },
      },
      {
        text: {
          en: 'Switch on one type of Kenyon cells (KCg-m, 2,189 neurons in this connectome) with optogenetics and watch the mushroom bodies light up in the 3D brain.',
          ru: 'Включите оптогенетикой один тип клеток Кеньона (KCg-m, 2 189 нейронов в этом коннектоме) и посмотрите, как загораются грибовидные тела в 3D-мозге.',
          kk: 'Оптогенетикамен Кеньон жасушаларының бір түрін (KCg-m, осы коннектомда 2 189 нейрон) қосып, 3D мидағы саңырауқұлақ денелердің жанғанын көріңіз.',
        },
        demo: '/?o=KCg-m:150',
      },
      {
        text: {
          en: 'Learning means connections change. In this model every connection is fixed: the weights come from one snapshot of one fly’s brain. So the model cannot learn or remember anything — no lesson here can show a memory forming.',
          ru: 'Обучение — это изменение связей. В этой модели все связи неизменны: веса взяты из одного снимка мозга одной мухи. Поэтому модель не может ничему научиться и ничего запомнить — ни один урок здесь не покажет, как формируется память.',
          kk: 'Үйрену — байланыстардың өзгеруі. Бұл модельде барлық байланыс тұрақты: салмақтар бір шыбын миының бір суретінен алынған. Сондықтан модель ештеңе үйрене де, есте сақтай да алмайды — мұндағы бірде-бір сабақ жадтың қалыптасуын көрсете алмайды.',
        },
      },
      {
        text: {
          en: 'To model memory you would also need rules for how synapses change with experience (plasticity). That is a research question of its own, beyond this lab.',
          ru: 'Чтобы моделировать память, нужны ещё правила, по которым синапсы меняются с опытом (пластичность). Это отдельный исследовательский вопрос, за пределами этой лаборатории.',
          kk: 'Жадты модельдеу үшін синапстардың тәжірибемен қалай өзгеретіні туралы ережелер (пластикалық) де керек. Бұл — осы зертханадан тыс жеке зерттеу сұрағы.',
        },
      },
    ],
    quiz: [
      {
        q: { en: 'Can this model learn?', ru: 'Может ли эта модель учиться?', kk: 'Бұл модель үйрене ала ма?' },
        options: [
          { en: 'No — all its connections are fixed', ru: 'Нет — все её связи неизменны', kk: 'Жоқ — оның барлық байланысы тұрақты' },
          { en: 'Yes, after a few runs', ru: 'Да, после нескольких запусков', kk: 'Иә, бірнеше іске қосудан кейін' },
          { en: 'Only with sugar', ru: 'Только с сахаром', kk: 'Тек қантпен' },
        ],
        answer: 0,
        why: {
          en: 'Learning needs synapses that change; here the weights are a fixed snapshot.',
          ru: 'Для обучения синапсы должны меняться; здесь веса — неизменный снимок.',
          kk: 'Үйрену үшін синапстар өзгеруі керек; мұнда салмақтар — тұрақты сурет.',
        },
      },
      {
        q: { en: 'Which brain region is known for learning in flies?', ru: 'Какая область мозга мухи известна ролью в обучении?', kk: 'Шыбын миының қай аймағы үйренудегі рөлімен белгілі?' },
        options: [
          { en: 'The mushroom body', ru: 'Грибовидное тело', kk: 'Саңырауқұлақ дене' },
          { en: 'The Giant Fiber', ru: 'Гигантское волокно', kk: 'Алып талшық' },
          { en: 'The proboscis', ru: 'Хоботок', kk: 'Тұмсықша' },
        ],
        answer: 0,
        why: {
          en: 'Kenyon cells, the intrinsic neurons of the mushroom body, are at the centre of fly learning research.',
          ru: 'Клетки Кеньона — собственные нейроны грибовидного тела — в центре исследований обучения мух.',
          kk: 'Кеньон жасушалары — саңырауқұлақ дененің өз нейрондары — шыбындардың үйренуін зерттеудің орталығында.',
        },
      },
    ],
    sources: [ZHENG, FLYWIRE],
  },
  {
    id: 'switching',
    title: { en: 'How scientists switch neurons on and off', ru: 'Как учёные включают и выключают нейроны', kk: 'Ғалымдар нейрондарды қалай қосып, өшіреді' },
    summary: {
      en: 'Optogenetics and silencing — and what they reveal about walking and feeding.',
      ru: 'Оптогенетика и выключение — и что они рассказывают о ходьбе и питании.',
      kk: 'Оптогенетика және өшіру — олар жүру мен қоректену туралы не айтады.',
    },
    steps: [
      {
        text: {
          en: 'In optogenetics scientists put light-sensitive proteins into chosen neurons and switch them on with light. In this lab “optogenetics” makes every neuron of one cell type fire.',
          ru: 'В оптогенетике учёные встраивают в выбранные нейроны светочувствительные белки и включают их светом. В этой лаборатории «оптогенетика» заставляет срабатывать все нейроны одного типа.',
          kk: 'Оптогенетикада ғалымдар таңдалған нейрондарға жарыққа сезімтал ақуыздар енгізіп, оларды жарықпен қосады. Бұл зертханада «оптогенетика» бір түрдегі барлық нейронды іске қосады.',
        },
      },
      {
        text: {
          en: 'Bidaye et al. 2014 found that activating the “moonwalker” descending neurons (MDN) makes flies walk backwards. Try it in the model.',
          ru: 'Bidaye et al. 2014 обнаружили, что активация нисходящих нейронов «мунвокер» (MDN) заставляет мух идти назад. Попробуйте это в модели.',
          kk: 'Bidaye et al. 2014 «мунуокер» төмендеуші нейрондарын (MDN) іске қосу шыбындарды артқа жүргізетінін анықтаған. Модельде байқап көріңіз.',
        },
        demo: '/?o=MDN:150',
      },
      {
        text: {
          en: 'Activating DNp09 on one side makes flies walk forward and turn toward that side (Bidaye et al. 2020). In the model the right DNp09 also recruits the right DNa02, a steering neuron.',
          ru: 'Активация DNp09 с одной стороны заставляет мух идти вперёд и поворачивать в эту сторону (Bidaye et al. 2020). В модели правый DNp09 заодно включает правый DNa02 — нейрон поворота.',
          kk: 'Бір жақтағы DNp09-ды іске қосу шыбындарды алға жүргізіп, сол жаққа бұрады (Bidaye et al. 2020). Модельде оң DNp09 бұрылу нейроны — оң DNa02-ны да қосады.',
        },
        demo: '/?o=DNp09.r:150',
      },
      {
        text: {
          en: 'Silencing works the other way. Shiu et al. silenced neurons by setting their outputs to zero. Silence the GNG region and sugar no longer makes the fly extend its proboscis.',
          ru: 'Выключение работает наоборот. Shiu et al. выключали нейроны, обнуляя их выходы. Выключите область GNG — и сахар больше не заставляет муху выдвигать хоботок.',
          kk: 'Өшіру керісінше жұмыс істейді. Shiu et al. нейрондарды шығыстарын нөлге теңестіріп өшірген. GNG аймағын өшіріңіз — қант енді шыбынды тұмсықшасын шығаруға мәжбүрлемейді.',
        },
        demo: '/?s=sugar:150&x=GNG',
      },
    ],
    quiz: [
      {
        q: { en: 'What happens when MDN neurons are activated?', ru: 'Что происходит при активации нейронов MDN?', kk: 'MDN нейрондары іске қосылғанда не болады?' },
        options: [
          { en: 'The fly walks backwards', ru: 'Муха идёт назад', kk: 'Шыбын артқа жүреді' },
          { en: 'The fly feeds', ru: 'Муха ест', kk: 'Шыбын қоректенеді' },
          { en: 'The fly cleans its antennae', ru: 'Муха чистит антенны', kk: 'Шыбын мұртшаларын тазалайды' },
        ],
        answer: 0,
        why: {
          en: 'MDN = “moonwalker” descending neurons (Bidaye et al. 2014).',
          ru: 'MDN — нисходящие нейроны «мунвокер» (Bidaye et al. 2014).',
          kk: 'MDN — «мунуокер» төмендеуші нейрондары (Bidaye et al. 2014).',
        },
      },
      {
        q: { en: 'Sugar is on, the GNG is silenced. What does the fly do?', ru: 'Сахар включён, GNG выключена. Что делает муха?', kk: 'Қант қосулы, GNG өшірілген. Шыбын не істейді?' },
        options: [
          { en: 'It no longer extends its proboscis', ru: 'Больше не выдвигает хоботок', kk: 'Тұмсықшасын енді шығармайды' },
          { en: 'It feeds even more', ru: 'Ест ещё больше', kk: 'Одан да көп жейді' },
          { en: 'It walks backwards', ru: 'Идёт назад', kk: 'Артқа жүреді' },
        ],
        answer: 0,
        why: {
          en: 'The sugar → MN9 pathway runs through the GNG; silencing it cuts the reflex.',
          ru: 'Путь сахар → MN9 проходит через GNG; её выключение обрывает рефлекс.',
          kk: 'Қант → MN9 жолы GNG арқылы өтеді; оны өшіру рефлексті үзеді.',
        },
      },
    ],
    sources: [
      { cite: 'Bidaye et al., Science 2014', doi: '10.1126/science.1249964' },
      { cite: 'Bidaye et al., Neuron 2020', doi: '10.1016/j.neuron.2020.07.032' },
      SHIU,
    ],
  },
  {
    id: 'weight',
    title: { en: 'How much does a brain weigh — in data?', ru: 'Сколько весит мозг — в данных?', kk: 'Ми қанша салмақ тартады — деректе?' },
    summary: {
      en: 'From grams to terabytes to megabytes.',
      ru: 'От граммов к терабайтам и мегабайтам.',
      kk: 'Граммнан терабайтқа және мегабайтқа дейін.',
    },
    steps: [
      {
        text: {
          en: 'A mouse brain weighs about 0.42 g and has about 71 million neurons (Herculano-Houzel et al. 2006). A human brain has about 86 billion neurons (Azevedo et al. 2009). The fly: 139,255.',
          ru: 'Мозг мыши весит около 0,42 г и содержит около 71 млн нейронов (Herculano-Houzel et al. 2006). В мозге человека около 86 млрд нейронов (Azevedo et al. 2009). У мухи — 139 255.',
          kk: 'Тышқан миының салмағы шамамен 0,42 г, онда шамамен 71 млн нейрон бар (Herculano-Houzel et al. 2006). Адам миында шамамен 86 млрд нейрон бар (Azevedo et al. 2009). Шыбында — 139 255.',
        },
        demo: '/scale',
      },
      {
        text: {
          en: 'To map the fly’s wiring, a whole fly brain was cut into thin slices and photographed with an electron microscope: about 21 million images, about 106 TB (Zheng et al. 2018).',
          ru: 'Чтобы картировать связи мухи, весь её мозг разрезали на тонкие слои и сфотографировали электронным микроскопом: около 21 млн снимков, около 106 ТБ (Zheng et al. 2018).',
          kk: 'Шыбынның байланыстарын картаға түсіру үшін оның бүкіл миы жұқа қабаттарға кесіліп, электрондық микроскоппен суретке түсірілген: шамамен 21 млн сурет, шамамен 106 ТБ (Zheng et al. 2018).',
        },
      },
      {
        text: {
          en: 'From those images FlyWire traced 139,255 neurons and about 50 million synapses. The part this lab simulates (pairs of neurons with at least 5 synapses) fits in 10.85 MB.',
          ru: 'По этим снимкам FlyWire проследил 139 255 нейронов и около 50 млн синапсов. Часть, которую симулирует лаборатория (пары нейронов с 5 и более синапсами), умещается в 10,85 МБ.',
          kk: 'Сол суреттерден FlyWire 139 255 нейрон мен шамамен 50 млн синапсты анықтады. Зертхана симуляциялайтын бөлік (кемінде 5 синапсы бар нейрон жұптары) 10,85 МБ-қа сыяды.',
        },
      },
      {
        text: {
          en: 'You can compress it further: merging neurons of one cell type and storing each weight in 4 bits gives 1.82 MB, and in our tests the fly still feeds, escapes and grooms. Try other settings on the Compress page.',
          ru: 'Можно сжать ещё сильнее: если объединить нейроны одного типа и хранить каждый вес в 4 битах, получится 1,82 МБ — и в наших тестах муха всё ещё ест, убегает и чистится. Попробуйте другие настройки на странице «Сожми мозг».',
          kk: 'Одан әрі сығуға болады: бір түрдегі нейрондарды біріктіріп, әр салмақты 4 битпен сақтаса, 1,82 МБ шығады — біздің тесттерде шыбын әлі де қоректеніп, қашып, тазаланады. «Миды сығу» бетінде басқа баптауларды байқап көріңіз.',
        },
        demo: '/compress',
      },
    ],
    quiz: [
      {
        q: { en: 'About how much data are the microscope images of one fly brain?', ru: 'Сколько примерно занимают снимки микроскопа одного мозга мухи?', kk: 'Бір шыбын миының микроскоп суреттері шамамен қанша орын алады?' },
        options: [
          { en: 'About 106 TB', ru: 'Около 106 ТБ', kk: 'Шамамен 106 ТБ' },
          { en: 'About 10 MB', ru: 'Около 10 МБ', kk: 'Шамамен 10 МБ' },
          { en: 'About 1 GB', ru: 'Около 1 ГБ', kk: 'Шамамен 1 ГБ' },
        ],
        answer: 0,
        why: {
          en: '~21 million images, ~106 TB (Zheng et al. 2018). The wiring extracted from them is millions of times smaller.',
          ru: '~21 млн снимков, ~106 ТБ (Zheng et al. 2018). Извлечённая из них схема связей в миллионы раз меньше.',
          kk: '~21 млн сурет, ~106 ТБ (Zheng et al. 2018). Олардан алынған байланыс сызбасы миллиондаған есе кіші.',
        },
      },
      {
        q: { en: 'About how many neurons does a human brain have?', ru: 'Сколько примерно нейронов в мозге человека?', kk: 'Адам миында шамамен қанша нейрон бар?' },
        options: [
          { en: 'About 86 billion', ru: 'Около 86 млрд', kk: 'Шамамен 86 млрд' },
          { en: 'About 139 thousand', ru: 'Около 139 тысяч', kk: 'Шамамен 139 мың' },
          { en: 'About 71 million', ru: 'Около 71 млн', kk: 'Шамамен 71 млн' },
        ],
        answer: 0,
        why: {
          en: '86.1 ± 8.1 billion (Azevedo et al. 2009); 139 thousand is the fly, 71 million the mouse.',
          ru: '86,1 ± 8,1 млрд (Azevedo et al. 2009); 139 тысяч — это муха, 71 млн — мышь.',
          kk: '86,1 ± 8,1 млрд (Azevedo et al. 2009); 139 мың — шыбын, 71 млн — тышқан.',
        },
      },
    ],
    sources: [
      { cite: 'Herculano-Houzel et al., PNAS 2006', doi: '10.1073/pnas.0604911103' },
      { cite: 'Azevedo et al., J. Comp. Neurol. 2009', doi: '10.1002/cne.21974' },
      ZHENG,
      FLYWIRE,
      { cite: 'Model results', file: 'tools/calibrate/results/compression.json' },
    ],
  },
];
