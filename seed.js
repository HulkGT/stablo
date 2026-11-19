/* Ausgangsdaten aus dem Canva-Stammbaum von Denis Jozić.
   Wird nur beim allerersten Start benutzt, danach zählt der gemeinsame Speicher. */
window.SEED = {
  v: 1,
  people: [
    {id:'p01', n:'Filip Penić',        b:'1907', d:'1968', ph:null},
    {id:'p02', n:'Terezija Kelava',    b:'1911', d:'2000', ph:'terezija_kelava'},
    {id:'p03', n:'Ivan Jozić',         b:'',     d:'1979', ph:null, nt:'Nositelj imena kuće Jozić.'},
    {id:'p04', n:'Barbara Dikanović',  b:'',     d:'',     ph:null, nt:'U zapisima i kao Imrović.'},
    {id:'p05', n:'Jozo Knežević',      b:'',     d:'',     ph:null},
    {id:'p06', n:'Anka Knežević',      b:'',     d:'',     ph:null},
    {id:'p07', n:'Božo Čalušić',       b:'1911', d:'1945', ph:null},
    {id:'p08', n:'Ljubica Čalušić',    b:'1912', d:'2007', ph:null},

    {id:'p09', n:'Miroslava Penić',    b:'1935', d:'2005', ph:'miroslava_penic', pc:'c1'},
    {id:'p10', n:'Pavao Jozić',        b:'1934', d:'2010', ph:'pavao_jozic',     pc:'c2'},
    {id:'p11', n:'Anica Knežević',     b:'1935', d:'2024', ph:'anica_knezevic',  pc:'c3'},
    {id:'p12', n:'Ivo Čalušić',        b:'1935', d:'1981', ph:'ivo_calusic',     pc:'c4'},

    {id:'p13', n:'Dubravka Petrović',  b:'1977', d:'', ph:'dubravka_petrovic'},
    {id:'p14', n:'Damir Jozić',        b:'1974', d:'', ph:'damir_jozic',   pc:'c5'},
    {id:'p15', n:'Vitomir Adamović',   b:'1956', d:'', ph:null},
    {id:'p16', n:'Terezija Jozić',     b:'1960', d:'', ph:'terezija_jozic', pc:'c5'},
    {id:'p17', n:'Jasna Kisegi',       b:'1964', d:'', ph:'jasna_kisegi'},
    {id:'p18', n:'Antun Jozić',        b:'1956', d:'', ph:'antun_jozic',    pc:'c5'},
    {id:'p19', n:'Ivan Jozić',         b:'1954', d:'2019', ph:'ivan_jozic', pc:'c5'},
    {id:'p20', n:'Anka Čalušić',       b:'1960', d:'', ph:'anka_calusic',   pc:'c6'},
    {id:'p21', n:'Božo Čalušić',       b:'1955', d:'2006', ph:'bozo_calusic', pc:'c6'},
    {id:'p22', n:'Ljubica Čalušić',    b:'1963', d:'', ph:'ljubica_calusic', pc:'c6'},
    {id:'p23', n:'Pavo Arbanas',       b:'1956', d:'', ph:'pavo_arbanas'},
    {id:'p24', n:'Ruža Čalušić',       b:'1966', d:'', ph:'ruza_calusic',   pc:'c6'},
    {id:'p25', n:'Ivan Čurić',         b:'1967', d:'', ph:'ivan_curic'},

    {id:'p26', n:'Olga Brumnić',       b:'1975', d:'', ph:'olga_brumnic'},
    {id:'p27', n:'Daniel Jozić',       b:'1979', d:'', ph:'daniel_jozic',  pc:'c10'},
    {id:'p28', n:'Denis Jozić',        b:'1984', d:'', ph:'denis_jozic',   pc:'c10'},
    {id:'p29', n:'Helena Lažeta',      b:'1991', d:'', ph:'helena_lazeta'},

    {id:'p30', n:'Aria Jozić',         b:'2025', d:'', ph:'aria_jozic',    pc:'c14'}
  ],
  couples: [
    {id:'c1',  a:'p01', b:'p02'},
    {id:'c2',  a:'p03', b:'p04'},
    {id:'c3',  a:'p05', b:'p06'},
    {id:'c4',  a:'p07', b:'p08'},
    {id:'c5',  a:'p09', b:'p10'},
    {id:'c6',  a:'p11', b:'p12'},
    {id:'c7',  a:'p13', b:'p14'},
    {id:'c8',  a:'p15', b:'p16'},
    {id:'c9',  a:'p17', b:'p18'},
    {id:'c10', a:'p19', b:'p20'},
    {id:'c11', a:'p22', b:'p23'},
    {id:'c12', a:'p24', b:'p25'},
    {id:'c13', a:'p26', b:'p27'},
    {id:'c14', a:'p28', b:'p29'}
  ]
};
