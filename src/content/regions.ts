// Brain regions shown in the lab. Neuropil abbreviations and English names follow the standard nomenclature
// (Ito et al. 2014) as listed in FlyWire Codex; the grouping into categories is Codex's REGION_CATEGORIES
// (murthylab/codex, codex/data/brain_regions.py, Apache-2.0). Descriptions are deliberately short and general.
import type { Lang } from '../i18n';

type Text = Record<Lang, string>;

export interface RegionCategory {
  id: string;
  name: Text;
  role: Text;
  neuropils: string[];
}

export const NEUROPIL_NAMES: Record<string, string> = {
  AME: 'accessory medulla', LO: 'lobula', NO: 'noduli', BU: 'bulb', PB: 'protocerebral bridge', LH: 'lateral horn',
  LAL: 'lateral accessory lobe', SAD: 'saddle', CAN: 'cantle', AMMC: 'antennal mechanosensory and motor center',
  ICL: 'inferior clamp', VES: 'vest', IB: 'inferior bridge', ATL: 'antler', CRE: 'crepine',
  MB_PED: 'mushroom body pedunculus', MB_VL: 'mushroom body vertical lobe', MB_ML: 'mushroom body medial lobe',
  MB_CA: 'mushroom body calyx', FLA: 'flange', LOP: 'lobula plate', EB: 'ellipsoid body', AL: 'antennal lobe',
  ME: 'medulla', FB: 'fan-shaped body', SLP: 'superior lateral protocerebrum', SIP: 'superior intermediate protocerebrum',
  SMP: 'superior medial protocerebrum', AVLP: 'anterior ventrolateral protocerebrum',
  PVLP: 'posterior ventrolateral protocerebrum', WED: 'wedge', PLP: 'posterior lateral protocerebrum',
  AOTU: 'anterior optic tubercle', GOR: 'gorget', SPS: 'superior posterior slope', IPS: 'inferior posterior slope',
  SCL: 'superior clamp', EPA: 'epaulette', GNG: 'gnathal ganglia', PRW: 'prow', GA: 'gall', LA: 'lamina',
  OCG: 'ocellar ganglion', UNASGD: 'unassigned',
};

export const REGION_CATEGORIES: RegionCategory[] = [
  {
    id: 'optic',
    name: { en: 'Optic lobes', ru: 'Зрительные доли', kk: 'Көру бөліктері' },
    role: {
      en: 'Process input from the compound eyes: brightness, colour, motion and approaching objects.',
      ru: 'Обрабатывают сигналы фасеточных глаз: яркость, цвет, движение, приближающиеся объекты.',
      kk: 'Фасеткалы көздердің сигналдарын өңдейді: жарық, түс, қозғалыс, жақындап келе жатқан заттар.',
    },
    neuropils: ['LA', 'ME', 'AME', 'LO', 'LOP'],
  },
  {
    id: 'ventrolateral',
    name: { en: 'Ventrolateral neuropils', ru: 'Вентролатеральные области', kk: 'Вентролатералды аймақтар' },
    role: {
      en: 'Receive visual and antennal mechanosensory information from projection neurons, including looming detectors.',
      ru: 'Получают зрительную и механосенсорную информацию от проекционных нейронов, в том числе от детекторов приближения.',
      kk: 'Проекциялық нейрондардан, соның ішінде жақындау детекторларынан, көру және механосенсорлық ақпарат алады.',
    },
    neuropils: ['AVLP', 'PVLP', 'WED', 'PLP', 'AOTU'],
  },
  {
    id: 'antennal_lobe',
    name: { en: 'Antennal lobes', ru: 'Антеннальные доли', kk: 'Антенна бөліктері' },
    role: {
      en: 'First relay for smell: olfactory receptor neurons connect to projection neurons here.',
      ru: 'Первая станция обоняния: здесь обонятельные рецепторные нейроны передают сигнал проекционным нейронам.',
      kk: 'Иіс сезудің алғашқы бекеті: мұнда иіс рецептор нейрондары сигналды проекциялық нейрондарға береді.',
    },
    neuropils: ['AL'],
  },
  {
    id: 'mushroom_body',
    name: { en: 'Mushroom bodies', ru: 'Грибовидные тела', kk: 'Саңырауқұлақ денелері' },
    role: {
      en: 'Learning and memory, best known for linking odours with reward or punishment. Learning is not simulated here.',
      ru: 'Обучение и память, особенно связь запахов с наградой или наказанием. Обучение в этой модели не моделируется.',
      kk: 'Үйрену және жады, әсіресе иісті марапатпен не жазамен байланыстыру. Бұл модельде үйрену модельденбейді.',
    },
    neuropils: ['MB_CA', 'MB_PED', 'MB_VL', 'MB_ML'],
  },
  {
    id: 'lateral_horn',
    name: { en: 'Lateral horn', ru: 'Латеральный рог', kk: 'Латералды мүйіз' },
    role: {
      en: 'Innate, unlearned responses to odours.',
      ru: 'Врождённые, необученные реакции на запахи.',
      kk: 'Иістерге туа біткен, үйренбеген жауаптар.',
    },
    neuropils: ['LH'],
  },
  {
    id: 'central_complex',
    name: { en: 'Central complex', ru: 'Центральный комплекс', kk: 'Орталық кешен' },
    role: {
      en: 'Navigation: keeps track of heading and helps steer walking and flight.',
      ru: 'Навигация: отслеживает направление движения и помогает управлять ходьбой и полётом.',
      kk: 'Навигация: қозғалыс бағытын бақылап, жүру мен ұшуды басқаруға көмектеседі.',
    },
    neuropils: ['PB', 'FB', 'EB', 'NO'],
  },
  {
    id: 'lateral_complex',
    name: { en: 'Lateral complex', ru: 'Латеральный комплекс', kk: 'Латералды кешен' },
    role: {
      en: 'Connects the central complex with other brain areas and with neurons that descend to the body.',
      ru: 'Связывает центральный комплекс с другими областями и с нейронами, идущими к телу.',
      kk: 'Орталық кешенді басқа аймақтармен және денеге түсетін нейрондармен байланыстырады.',
    },
    neuropils: ['BU', 'LAL', 'GA'],
  },
  {
    id: 'superior',
    name: { en: 'Superior neuropils', ru: 'Верхние области', kk: 'Жоғарғы аймақтар' },
    role: {
      en: 'Integrative areas linked to the mushroom bodies and internal states; many functions are still open.',
      ru: 'Интегративные области, связанные с грибовидными телами и внутренним состоянием; многое ещё не изучено.',
      kk: 'Саңырауқұлақ денелерімен және ішкі күймен байланысты біріктіруші аймақтар; көп нәрсе әлі зерттелмеген.',
    },
    neuropils: ['SLP', 'SIP', 'SMP'],
  },
  {
    id: 'inferior',
    name: { en: 'Inferior neuropils', ru: 'Нижние области', kk: 'Төменгі аймақтар' },
    role: {
      en: 'Integrative areas between sensory and premotor regions; their roles are less well understood.',
      ru: 'Интегративные области между сенсорными и премоторными зонами; их роль изучена хуже.',
      kk: 'Сенсорлық және премоторлық аймақтар арасындағы біріктіруші аймақтар; рөлі аз зерттелген.',
    },
    neuropils: ['ICL', 'IB', 'ATL', 'CRE', 'SCL'],
  },
  {
    id: 'ventromedial',
    name: { en: 'Ventromedial neuropils', ru: 'Вентромедиальные области', kk: 'Вентромедиалды аймақтар' },
    role: {
      en: 'Premotor areas where many descending neurons collect input before sending commands to the body.',
      ru: 'Премоторные области: здесь многие нисходящие нейроны собирают входы, прежде чем отправить команды телу.',
      kk: 'Премоторлық аймақтар: мұнда көп төмен түсетін нейрондар денеге бұйрық жібермес бұрын сигнал жинайды.',
    },
    neuropils: ['VES', 'GOR', 'SPS', 'IPS', 'EPA'],
  },
  {
    id: 'periesophageal',
    name: { en: 'Periesophageal neuropils', ru: 'Околопищеводные области', kk: 'Өңеш маңындағы аймақтар' },
    role: {
      en: 'Include the antennal mechanosensory centre (touch, sound, wind, gravity) and areas involved in feeding.',
      ru: 'Включают антеннальный механосенсорный центр (касание, звук, ветер, гравитация) и зоны, связанные с питанием.',
      kk: 'Антеннаның механосенсорлық орталығын (тию, дыбыс, жел, гравитация) және қоректенуге қатысты аймақтарды қамтиды.',
    },
    neuropils: ['SAD', 'CAN', 'AMMC', 'FLA', 'PRW'],
  },
  {
    id: 'gng',
    name: { en: 'Gnathal ganglia', ru: 'Гнатальные ганглии', kk: 'Гнатальды ганглийлер' },
    role: {
      en: 'Taste processing and feeding control; home of mouthpart motor neurons such as MN9.',
      ru: 'Обработка вкуса и управление питанием; здесь находятся моторные нейроны ротового аппарата, например MN9.',
      kk: 'Дәмді өңдеу және қоректенуді басқару; мұнда MN9 сияқты ауыз мүшелерінің моторлық нейрондары орналасқан.',
    },
    neuropils: ['GNG'],
  },
  {
    id: 'ocelli',
    name: { en: 'Ocellar ganglion', ru: 'Ганглий глазков', kk: 'Көзшелер ганглийі' },
    role: {
      en: 'Receives input from the three simple eyes (ocelli) on top of the head.',
      ru: 'Получает сигналы от трёх простых глазков на макушке.',
      kk: 'Төбедегі үш қарапайым көзшеден сигнал алады.',
    },
    neuropils: ['OCG'],
  },
];

/** "LO_R" -> "LO", "MB_CA_L" -> "MB_CA", "GNG" -> "GNG". */
export function neuropilBase(name: string): string {
  return name.replace(/_[LR]$/, '');
}

export function neuropilSide(name: string): 'L' | 'R' | null {
  const m = /_([LR])$/.exec(name);
  return m ? (m[1] as 'L' | 'R') : null;
}

const CATEGORY_OF = new Map(REGION_CATEGORIES.flatMap((c) => c.neuropils.map((n) => [n, c] as const)));

export function categoryOf(neuropil: string): RegionCategory | undefined {
  return CATEGORY_OF.get(neuropilBase(neuropil));
}
