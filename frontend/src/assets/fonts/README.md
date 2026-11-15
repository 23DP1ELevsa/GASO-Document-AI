# Lietotnes lokālie fonti

`Manrope-Variable.ttf` ir mobilās saskarnes fonts (200–800), pārnests atbilstoši Lovable `DESIGN_SPEC.md`. Lejupielādēts no [Google Fonts oficiālā avota](https://github.com/google/fonts/blob/main/ofl/manrope/Manrope%5Bwght%5D.ttf). Licence: [SIL Open Font License 1.1](Manrope-OFL.txt). SHA-256: `3ae11c49db0455a3cc33e37d380f20fdb8c7f8b41dc07625c177e3d87a9d6ae6`. Fonts tiek piegādāts un kešots lokāli; saskarne neprasa fontu CDN.

## Noto Sans PDF informācijas lapām

`NotoSans-Regular.ttf` ir nemainīts Noto Sans Regular 2.008 fonts no oficiālā `notofonts/noto-fonts` arhīva. Tas atbalsta latviešu diakritiku, latīņu un kirilicas tekstu. Tā nav visu Unicode simbolu bibliotēka; neatbalstītus simbolus PDF modulis noraida ar skaidru kļūdu.

- Licence: **SIL Open Font License 1.1**.
- Pilns licences un autortiesību teksts: [`public/licenses/NotoSans-OFL.txt`](../../../public/licenses/NotoSans-OFL.txt).
- Precīzs avota commit, baitu skaits un SHA-256: [`source.json`](source.json).
- Avots: [oficiālais Noto fontu arhīvs](https://github.com/notofonts/noto-fonts/tree/main/hinted/ttf/NotoSans).

Vite kopē fontu kā lokālu lietotnes resursu; PWA to iekļauj interfeisa kešā. PDF izveide neizmanto fontu CDN. Fonta apakškopa tiek iegulta katra PDF informācijas lapās. Eksports bez informācijas lapas fontu neielādē un neiegulst.
