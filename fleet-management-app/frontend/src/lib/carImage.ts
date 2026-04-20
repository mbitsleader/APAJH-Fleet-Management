/**
 * Imagin.studio car image utility
 * Generates a 3D car render URL from brand + model.
 * Falls back to null if the brand is not supported.
 */

// ─── Types ────────────────────────────────────────────────────────────────────
export interface CarModel {
  label: string;          // affichage dans le formulaire: "Clio V"
  imagin: string;         // slug imagin.studio: "clio"
}

export interface CarBrand {
  label: string;          // "Renault"
  imagin: string;         // slug imagin.studio: "renault"
  models: CarModel[];
}

// ─── Catalogue (marques → modèles) ───────────────────────────────────────────
export const CAR_CATALOGUE: CarBrand[] = [
  {
    label: 'Renault', imagin: 'renault',
    models: [
      { label: 'Clio IV', imagin: 'clio' },
      { label: 'Clio V', imagin: 'clio' },
      { label: 'Mégane IV', imagin: 'megane' },
      { label: 'Twingo III', imagin: 'twingo' },
      { label: 'Kangoo II', imagin: 'kangoo' },
      { label: 'Kangoo III', imagin: 'kangoo' },
      { label: 'Trafic III', imagin: 'trafic' },
      { label: 'Master III', imagin: 'master' },
      { label: 'Captur II', imagin: 'captur' },
      { label: 'Kadjar', imagin: 'kadjar' },
      { label: 'Zoé', imagin: 'zoe' },
    ],
  },
  {
    label: 'Peugeot', imagin: 'peugeot',
    models: [
      { label: '108', imagin: '108' },
      { label: '208 I', imagin: '208' },
      { label: '208 II', imagin: '208' },
      { label: '308 II', imagin: '308' },
      { label: '308 III', imagin: '308' },
      { label: '2008 II', imagin: '2008' },
      { label: '3008 II', imagin: '3008' },
      { label: '5008 II', imagin: '5008' },
      { label: 'Partner III', imagin: 'partner' },
      { label: 'Expert III', imagin: 'expert' },
      { label: 'Traveller', imagin: 'traveller' },
      { label: 'Boxer III', imagin: 'boxer' },
      { label: 'e-208', imagin: '208' },
      { label: 'e-2008', imagin: '2008' },
    ],
  },
  {
    label: 'Citroën', imagin: 'citroen',
    models: [
      { label: 'C3 III', imagin: 'c3' },
      { label: 'ë-C3', imagin: 'c3' },
      { label: 'C4 III', imagin: 'c4' },
      { label: 'ë-C4', imagin: 'c4' },
      { label: 'Berlingo III', imagin: 'berlingo' },
      { label: 'Jumpy III', imagin: 'jumpy' },
      { label: 'Spacetourer', imagin: 'spacetourer' },
      { label: 'Jumper III', imagin: 'jumper' },
    ],
  },
  {
    label: 'Volkswagen', imagin: 'volkswagen',
    models: [
      { label: 'Golf VII', imagin: 'golf' },
      { label: 'Golf VIII', imagin: 'golf' },
      { label: 'Polo VI', imagin: 'polo' },
      { label: 'Passat B8', imagin: 'passat' },
      { label: 'Tiguan II', imagin: 'tiguan' },
      { label: 'Touran III', imagin: 'touran' },
      { label: 'Transporter T6', imagin: 'transporter' },
      { label: 'Transporter T7', imagin: 'transporter' },
      { label: 'Caddy V', imagin: 'caddy' },
      { label: 'Crafter II', imagin: 'crafter' },
    ],
  },
  {
    label: 'Dacia', imagin: 'dacia',
    models: [
      { label: 'Sandero III', imagin: 'sandero' },
      { label: 'Duster II', imagin: 'duster' },
      { label: 'Lodgy', imagin: 'lodgy' },
      { label: 'Dokker', imagin: 'dokker' },
    ],
  },
  {
    label: 'Ford', imagin: 'ford',
    models: [
      { label: 'Fiesta VII', imagin: 'fiesta' },
      { label: 'Focus IV', imagin: 'focus' },
      { label: 'Transit Custom', imagin: 'transit-custom' },
      { label: 'Transit VI', imagin: 'transit' },
      { label: 'Tourneo Connect', imagin: 'tourneo-connect' },
      { label: 'Puma', imagin: 'puma' },
    ],
  },
  {
    label: 'Toyota', imagin: 'toyota',
    models: [
      { label: 'Yaris IV', imagin: 'yaris' },
      { label: 'Corolla XII', imagin: 'corolla' },
      { label: 'RAV4 V', imagin: 'rav4' },
      { label: 'ProAce II', imagin: 'proace' },
      { label: 'ProAce City', imagin: 'proace-city' },
      { label: 'C-HR', imagin: 'c-hr' },
    ],
  },
  {
    label: 'Opel', imagin: 'opel',
    models: [
      { label: 'Corsa F', imagin: 'corsa' },
      { label: 'Astra L', imagin: 'astra' },
      { label: 'Vivaro C', imagin: 'vivaro' },
      { label: 'Movano B', imagin: 'movano' },
      { label: 'Combo E', imagin: 'combo' },
    ],
  },
  {
    label: 'Mercedes-Benz', imagin: 'mercedes-benz',
    models: [
      { label: 'Classe A IV', imagin: 'a-class' },
      { label: 'Classe B III', imagin: 'b-class' },
      { label: 'Classe E V', imagin: 'e-class' },
      { label: 'Vito III', imagin: 'vito' },
      { label: 'Classe V II', imagin: 'v-class' },
      { label: 'Sprinter III', imagin: 'sprinter' },
      { label: 'Citan II', imagin: 'citan' },
    ],
  },
  {
    label: 'BMW', imagin: 'bmw',
    models: [
      { label: 'Série 1 F40', imagin: '1-series' },
      { label: 'Série 3 G20', imagin: '3-series' },
      { label: 'X1 U11', imagin: 'x1' },
      { label: 'X3 G01', imagin: 'x3' },
    ],
  },
  {
    label: 'Audi', imagin: 'audi',
    models: [
      { label: 'A1 II', imagin: 'a1' },
      { label: 'A3 8Y', imagin: 'a3' },
      { label: 'A4 B9', imagin: 'a4' },
      { label: 'Q3 II', imagin: 'q3' },
      { label: 'Q5 II', imagin: 'q5' },
    ],
  },
  {
    label: 'Seat', imagin: 'seat',
    models: [
      { label: 'Ibiza V', imagin: 'ibiza' },
      { label: 'Leon III', imagin: 'leon' },
      { label: 'Leon IV', imagin: 'leon' },
      { label: 'Ateca', imagin: 'ateca' },
      { label: 'Tarraco', imagin: 'tarraco' },
    ],
  },
  {
    label: 'Skoda', imagin: 'skoda',
    models: [
      { label: 'Fabia IV', imagin: 'fabia' },
      { label: 'Octavia IV', imagin: 'octavia' },
      { label: 'Superb III', imagin: 'superb' },
      { label: 'Kodiaq', imagin: 'kodiaq' },
      { label: 'Kamiq', imagin: 'kamiq' },
    ],
  },
  {
    label: 'Kia', imagin: 'kia',
    models: [
      { label: 'Picanto III', imagin: 'picanto' },
      { label: 'Ceed III', imagin: 'ceed' },
      { label: 'Sportage V', imagin: 'sportage' },
      { label: 'Niro II', imagin: 'niro' },
      { label: 'e-Niro', imagin: 'niro' },
    ],
  },
  {
    label: 'Hyundai', imagin: 'hyundai',
    models: [
      { label: 'i10 III', imagin: 'i10' },
      { label: 'i20 III', imagin: 'i20' },
      { label: 'i30 PD', imagin: 'i30' },
      { label: 'Tucson IV', imagin: 'tucson' },
      { label: 'Ioniq 5', imagin: 'ioniq-5' },
    ],
  },
  {
    label: 'Nissan', imagin: 'nissan',
    models: [
      { label: 'Micra V', imagin: 'micra' },
      { label: 'Qashqai III', imagin: 'qashqai' },
      { label: 'Juke II', imagin: 'juke' },
      { label: 'NV200', imagin: 'nv200' },
      { label: 'Leaf II', imagin: 'leaf' },
    ],
  },
  {
    label: 'Fiat', imagin: 'fiat',
    models: [
      { label: '500 III', imagin: '500' },
      { label: 'Panda III', imagin: 'panda' },
      { label: 'Tipo II', imagin: 'tipo' },
      { label: 'Doblò IV', imagin: 'doblo' },
      { label: 'Ducato IV', imagin: 'ducato' },
    ],
  },
];

// ─── Lookup helper ────────────────────────────────────────────────────────────
/**
 * Returns an imagin.studio URL for the given brand/model label, or null if unsupported.
 * Matches on exact label (case-insensitive).
 */
export function getCarImageUrl(brand: string, model: string): string | null {
  const brandEntry = CAR_CATALOGUE.find(
    b => b.label.toLowerCase() === brand.toLowerCase().trim()
  );
  if (!brandEntry) return null;

  const modelEntry = brandEntry.models.find(
    m => m.label.toLowerCase() === model.toLowerCase().trim()
  );
  // If no exact match, try partial match on the imagin slug from the model name
  const modelSlug = modelEntry?.imagin
    ?? model.toLowerCase().trim().split(/\s+/)[0].replace(/[^a-z0-9-]/g, '');

  const params = new URLSearchParams({
    customer: 'img',
    make: brandEntry.imagin,
    modelFamily: modelSlug,
    angle: '01',
    paintId: 'COLOUR-white',
    width: '800',
    zoomType: 'fullscreen',
  });

  return `https://cdn.imagin.studio/getimage?${params.toString()}`;
}
