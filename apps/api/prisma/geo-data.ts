// County codes as used by IEBC / the First Schedule of the Constitution.
export const COUNTIES: [number, string][] = [
  [1, 'Mombasa'], [2, 'Kwale'], [3, 'Kilifi'], [4, 'Tana River'], [5, 'Lamu'],
  [6, 'Taita-Taveta'], [7, 'Garissa'], [8, 'Wajir'], [9, 'Mandera'], [10, 'Marsabit'],
  [11, 'Isiolo'], [12, 'Meru'], [13, 'Tharaka-Nithi'], [14, 'Embu'], [15, 'Kitui'],
  [16, 'Machakos'], [17, 'Makueni'], [18, 'Nyandarua'], [19, 'Nyeri'], [20, 'Kirinyaga'],
  [21, "Murang'a"], [22, 'Kiambu'], [23, 'Turkana'], [24, 'West Pokot'], [25, 'Samburu'],
  [26, 'Trans Nzoia'], [27, 'Uasin Gishu'], [28, 'Elgeyo-Marakwet'], [29, 'Nandi'], [30, 'Baringo'],
  [31, 'Laikipia'], [32, 'Nakuru'], [33, 'Narok'], [34, 'Kajiado'], [35, 'Kericho'],
  [36, 'Bomet'], [37, 'Kakamega'], [38, 'Vihiga'], [39, 'Bungoma'], [40, 'Busia'],
  [41, 'Siaya'], [42, 'Kisumu'], [43, 'Homa Bay'], [44, 'Migori'], [45, 'Kisii'],
  [46, 'Nyamira'], [47, 'Nairobi'],
];

// Pilot county: Kisumu (042). Sub-counties map to the 7 constituencies; 35 wards.
// Other counties' wards are loaded the same way from the IEBC gazette as they onboard.
export const PILOT_WARDS: Record<number, Record<string, string[]>> = {
  42: {
    'Kisumu Central': ['Railways', 'Migosi', 'Shaurimoyo Kaloleni', 'Market Milimani', 'Kondele', 'Nyalenda B'],
    'Kisumu East': ['Kajulu', 'Kolwa East', 'Manyatta B', 'Nyalenda A', 'Kolwa Central'],
    'Kisumu West': ['South West Kisumu', 'Central Kisumu', 'Kisumu North', 'West Kisumu', 'North West Kisumu'],
    Seme: ['West Seme', 'Central Seme', 'East Seme', 'North Seme'],
    Nyando: ['East Kano/Wawidhi', 'Awasi/Onjiko', 'Ahero', 'Kabonyo/Kanyagwal', 'Kobura'],
    Muhoroni: ['Miwani', 'Ombeyi', "Masogo/Nyang'oma", 'Chemelil', 'Muhoroni/Koru'],
    Nyakach: ['South West Nyakach', 'North Nyakach', 'Central Nyakach', 'West Nyakach', 'South East Nyakach'],
  },
};
