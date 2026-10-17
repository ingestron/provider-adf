// src/windows-zones.mjs
var windowsZones = {
  "": "Central Standard Time (Mexico)",
  "africa/abidjan": "Greenwich Standard Time",
  "africa/accra": "Greenwich Standard Time",
  "africa/addis_ababa": "E. Africa Standard Time",
  "africa/algiers": "W. Central Africa Standard Time",
  "africa/asmara": "E. Africa Standard Time",
  "africa/asmera": "E. Africa Standard Time",
  "africa/bamako": "Greenwich Standard Time",
  "africa/bangui": "W. Central Africa Standard Time",
  "africa/banjul": "Greenwich Standard Time",
  "africa/bissau": "Greenwich Standard Time",
  "africa/blantyre": "South Africa Standard Time",
  "africa/brazzaville": "W. Central Africa Standard Time",
  "africa/bujumbura": "South Africa Standard Time",
  "africa/cairo": "Egypt Standard Time",
  "africa/casablanca": "Morocco Standard Time",
  "africa/ceuta": "Romance Standard Time",
  "africa/conakry": "Greenwich Standard Time",
  "africa/dakar": "Greenwich Standard Time",
  "africa/dar_es_salaam": "E. Africa Standard Time",
  "africa/djibouti": "E. Africa Standard Time",
  "africa/douala": "W. Central Africa Standard Time",
  "africa/el_aaiun": "Morocco Standard Time",
  "africa/freetown": "Greenwich Standard Time",
  "africa/gaborone": "South Africa Standard Time",
  "africa/harare": "South Africa Standard Time",
  "africa/johannesburg": "South Africa Standard Time",
  "africa/juba": "South Sudan Standard Time",
  "africa/kampala": "E. Africa Standard Time",
  "africa/khartoum": "Sudan Standard Time",
  "africa/kigali": "South Africa Standard Time",
  "africa/kinshasa": "W. Central Africa Standard Time",
  "africa/lagos": "W. Central Africa Standard Time",
  "africa/libreville": "W. Central Africa Standard Time",
  "africa/lome": "Greenwich Standard Time",
  "africa/luanda": "W. Central Africa Standard Time",
  "africa/lubumbashi": "South Africa Standard Time",
  "africa/lusaka": "South Africa Standard Time",
  "africa/malabo": "W. Central Africa Standard Time",
  "africa/maputo": "South Africa Standard Time",
  "africa/maseru": "South Africa Standard Time",
  "africa/mbabane": "South Africa Standard Time",
  "africa/mogadishu": "E. Africa Standard Time",
  "africa/monrovia": "Greenwich Standard Time",
  "africa/nairobi": "E. Africa Standard Time",
  "africa/ndjamena": "W. Central Africa Standard Time",
  "africa/niamey": "W. Central Africa Standard Time",
  "africa/nouakchott": "Greenwich Standard Time",
  "africa/ouagadougou": "Greenwich Standard Time",
  "africa/porto-novo": "W. Central Africa Standard Time",
  "africa/sao_tome": "Sao Tome Standard Time",
  "africa/timbuktu": "Greenwich Standard Time",
  "africa/tripoli": "Libya Standard Time",
  "africa/tunis": "W. Central Africa Standard Time",
  "africa/windhoek": "Namibia Standard Time",
  "america/adak": "Aleutian Standard Time",
  "america/anchorage": "Alaskan Standard Time",
  "america/anguilla": "SA Western Standard Time",
  "america/antigua": "SA Western Standard Time",
  "america/araguaina": "Tocantins Standard Time",
  "america/argentina/buenos_aires": "Argentina Standard Time",
  "america/argentina/catamarca": "Argentina Standard Time",
  "america/argentina/comodrivadavia": "Argentina Standard Time",
  "america/argentina/cordoba": "Argentina Standard Time",
  "america/argentina/jujuy": "Argentina Standard Time",
  "america/argentina/la_rioja": "Argentina Standard Time",
  "america/argentina/mendoza": "Argentina Standard Time",
  "america/argentina/rio_gallegos": "Argentina Standard Time",
  "america/argentina/salta": "Argentina Standard Time",
  "america/argentina/san_juan": "Argentina Standard Time",
  "america/argentina/san_luis": "Argentina Standard Time",
  "america/argentina/tucuman": "Argentina Standard Time",
  "america/argentina/ushuaia": "Argentina Standard Time",
  "america/aruba": "SA Western Standard Time",
  "america/asuncion": "Paraguay Standard Time",
  "america/atikokan": "SA Pacific Standard Time",
  "america/atka": "Aleutian Standard Time",
  "america/bahia": "Bahia Standard Time",
  "america/bahia_banderas": "Central Standard Time (Mexico)",
  "america/barbados": "SA Western Standard Time",
  "america/belem": "SA Eastern Standard Time",
  "america/belize": "Central America Standard Time",
  "america/blanc-sablon": "SA Western Standard Time",
  "america/boa_vista": "SA Western Standard Time",
  "america/bogota": "SA Pacific Standard Time",
  "america/boise": "Mountain Standard Time",
  "america/buenos_aires": "Argentina Standard Time",
  "america/cambridge_bay": "Mountain Standard Time",
  "america/campo_grande": "Central Brazilian Standard Time",
  "america/cancun": "Eastern Standard Time (Mexico)",
  "america/caracas": "Venezuela Standard Time",
  "america/catamarca": "Argentina Standard Time",
  "america/cayenne": "SA Eastern Standard Time",
  "america/cayman": "SA Pacific Standard Time",
  "america/chicago": "Central Standard Time",
  "america/chihuahua": "Central Standard Time (Mexico)",
  "america/ciudad_juarez": "Mountain Standard Time",
  "america/coral_harbour": "SA Pacific Standard Time",
  "america/cordoba": "Argentina Standard Time",
  "america/costa_rica": "Central America Standard Time",
  "america/coyhaique": "Magallanes Standard Time",
  "america/creston": "US Mountain Standard Time",
  "america/cuiaba": "Central Brazilian Standard Time",
  "america/curacao": "SA Western Standard Time",
  "america/danmarkshavn": "Greenwich Standard Time",
  "america/dawson": "Yukon Standard Time",
  "america/dawson_creek": "US Mountain Standard Time",
  "america/denver": "Mountain Standard Time",
  "america/detroit": "Eastern Standard Time",
  "america/dominica": "SA Western Standard Time",
  "america/edmonton": "Mountain Standard Time",
  "america/eirunepe": "SA Pacific Standard Time",
  "america/el_salvador": "Central America Standard Time",
  "america/ensenada": "Pacific Standard Time (Mexico)",
  "america/fort_nelson": "US Mountain Standard Time",
  "america/fort_wayne": "US Eastern Standard Time",
  "america/fortaleza": "SA Eastern Standard Time",
  "america/glace_bay": "Atlantic Standard Time",
  "america/godthab": "Greenland Standard Time",
  "america/goose_bay": "Atlantic Standard Time",
  "america/grand_turk": "Turks And Caicos Standard Time",
  "america/grenada": "SA Western Standard Time",
  "america/guadeloupe": "SA Western Standard Time",
  "america/guatemala": "Central America Standard Time",
  "america/guayaquil": "SA Pacific Standard Time",
  "america/guyana": "SA Western Standard Time",
  "america/halifax": "Atlantic Standard Time",
  "america/havana": "Cuba Standard Time",
  "america/hermosillo": "US Mountain Standard Time",
  "america/indiana/indianapolis": "US Eastern Standard Time",
  "america/indiana/knox": "Central Standard Time",
  "america/indiana/marengo": "US Eastern Standard Time",
  "america/indiana/petersburg": "Eastern Standard Time",
  "america/indiana/tell_city": "Central Standard Time",
  "america/indiana/vevay": "US Eastern Standard Time",
  "america/indiana/vincennes": "Eastern Standard Time",
  "america/indiana/winamac": "Eastern Standard Time",
  "america/indianapolis": "US Eastern Standard Time",
  "america/inuvik": "Mountain Standard Time",
  "america/iqaluit": "Eastern Standard Time",
  "america/jamaica": "SA Pacific Standard Time",
  "america/jujuy": "Argentina Standard Time",
  "america/juneau": "Alaskan Standard Time",
  "america/kentucky/louisville": "Eastern Standard Time",
  "america/kentucky/monticello": "Eastern Standard Time",
  "america/knox_in": "Central Standard Time",
  "america/kralendijk": "SA Western Standard Time",
  "america/la_paz": "SA Western Standard Time",
  "america/lima": "SA Pacific Standard Time",
  "america/los_angeles": "Pacific Standard Time",
  "america/louisville": "Eastern Standard Time",
  "america/lower_princes": "SA Western Standard Time",
  "america/maceio": "SA Eastern Standard Time",
  "america/managua": "Central America Standard Time",
  "america/manaus": "SA Western Standard Time",
  "america/marigot": "SA Western Standard Time",
  "america/martinique": "SA Western Standard Time",
  "america/matamoros": "Central Standard Time",
  "america/mazatlan": "Mountain Standard Time (Mexico)",
  "america/mendoza": "Argentina Standard Time",
  "america/menominee": "Central Standard Time",
  "america/merida": "Central Standard Time (Mexico)",
  "america/metlakatla": "Alaskan Standard Time",
  "america/mexico_city": "Central Standard Time (Mexico)",
  "america/miquelon": "Saint Pierre Standard Time",
  "america/moncton": "Atlantic Standard Time",
  "america/monterrey": "Central Standard Time (Mexico)",
  "america/montevideo": "Montevideo Standard Time",
  "america/montreal": "Eastern Standard Time",
  "america/montserrat": "SA Western Standard Time",
  "america/nassau": "Eastern Standard Time",
  "america/new_york": "Eastern Standard Time",
  "america/nipigon": "Eastern Standard Time",
  "america/nome": "Alaskan Standard Time",
  "america/noronha": "UTC-02",
  "america/north_dakota/beulah": "Central Standard Time",
  "america/north_dakota/center": "Central Standard Time",
  "america/north_dakota/new_salem": "Central Standard Time",
  "america/nuuk": "Greenland Standard Time",
  "america/ojinaga": "Central Standard Time",
  "america/panama": "SA Pacific Standard Time",
  "america/pangnirtung": "Eastern Standard Time",
  "america/paramaribo": "SA Eastern Standard Time",
  "america/phoenix": "US Mountain Standard Time",
  "america/port-au-prince": "Haiti Standard Time",
  "america/port_of_spain": "SA Western Standard Time",
  "america/porto_acre": "SA Pacific Standard Time",
  "america/porto_velho": "SA Western Standard Time",
  "america/puerto_rico": "SA Western Standard Time",
  "america/punta_arenas": "Magallanes Standard Time",
  "america/rainy_river": "Central Standard Time",
  "america/rankin_inlet": "Central Standard Time",
  "america/recife": "SA Eastern Standard Time",
  "america/regina": "Canada Central Standard Time",
  "america/resolute": "Central Standard Time",
  "america/rio_branco": "SA Pacific Standard Time",
  "america/rosario": "Argentina Standard Time",
  "america/santa_isabel": "Pacific Standard Time (Mexico)",
  "america/santarem": "SA Eastern Standard Time",
  "america/santiago": "Pacific SA Standard Time",
  "america/santo_domingo": "SA Western Standard Time",
  "america/sao_paulo": "E. South America Standard Time",
  "america/scoresbysund": "Azores Standard Time",
  "america/shiprock": "Mountain Standard Time",
  "america/sitka": "Alaskan Standard Time",
  "america/st_barthelemy": "SA Western Standard Time",
  "america/st_johns": "Newfoundland Standard Time",
  "america/st_kitts": "SA Western Standard Time",
  "america/st_lucia": "SA Western Standard Time",
  "america/st_thomas": "SA Western Standard Time",
  "america/st_vincent": "SA Western Standard Time",
  "america/swift_current": "Canada Central Standard Time",
  "america/tegucigalpa": "Central America Standard Time",
  "america/thule": "Atlantic Standard Time",
  "america/thunder_bay": "Eastern Standard Time",
  "america/tijuana": "Pacific Standard Time (Mexico)",
  "america/toronto": "Eastern Standard Time",
  "america/tortola": "SA Western Standard Time",
  "america/vancouver": "Pacific Standard Time",
  "america/virgin": "SA Western Standard Time",
  "america/whitehorse": "Yukon Standard Time",
  "america/winnipeg": "Central Standard Time",
  "america/yakutat": "Alaskan Standard Time",
  "america/yellowknife": "Mountain Standard Time",
  "antarctica/casey": "Central Pacific Standard Time",
  "antarctica/davis": "SE Asia Standard Time",
  "antarctica/dumontdurville": "West Pacific Standard Time",
  "antarctica/macquarie": "Tasmania Standard Time",
  "antarctica/mawson": "West Asia Standard Time",
  "antarctica/mcmurdo": "New Zealand Standard Time",
  "antarctica/palmer": "SA Eastern Standard Time",
  "antarctica/rothera": "SA Eastern Standard Time",
  "antarctica/south_pole": "New Zealand Standard Time",
  "antarctica/syowa": "E. Africa Standard Time",
  "antarctica/vostok": "Central Asia Standard Time",
  "arctic/longyearbyen": "W. Europe Standard Time",
  "asia/aden": "Arab Standard Time",
  "asia/almaty": "West Asia Standard Time",
  "asia/amman": "Jordan Standard Time",
  "asia/anadyr": "Russia Time Zone 11",
  "asia/aqtau": "West Asia Standard Time",
  "asia/aqtobe": "West Asia Standard Time",
  "asia/ashgabat": "West Asia Standard Time",
  "asia/ashkhabad": "West Asia Standard Time",
  "asia/atyrau": "West Asia Standard Time",
  "asia/baghdad": "Arabic Standard Time",
  "asia/bahrain": "Arab Standard Time",
  "asia/baku": "Azerbaijan Standard Time",
  "asia/bangkok": "SE Asia Standard Time",
  "asia/barnaul": "Altai Standard Time",
  "asia/beirut": "Middle East Standard Time",
  "asia/bishkek": "Central Asia Standard Time",
  "asia/brunei": "Singapore Standard Time",
  "asia/calcutta": "India Standard Time",
  "asia/chita": "Transbaikal Standard Time",
  "asia/choibalsan": "Ulaanbaatar Standard Time",
  "asia/chongqing": "China Standard Time",
  "asia/chungking": "China Standard Time",
  "asia/colombo": "Sri Lanka Standard Time",
  "asia/dacca": "Bangladesh Standard Time",
  "asia/damascus": "Syria Standard Time",
  "asia/dhaka": "Bangladesh Standard Time",
  "asia/dili": "Tokyo Standard Time",
  "asia/dubai": "Arabian Standard Time",
  "asia/dushanbe": "West Asia Standard Time",
  "asia/famagusta": "GTB Standard Time",
  "asia/gaza": "West Bank Standard Time",
  "asia/harbin": "China Standard Time",
  "asia/hebron": "West Bank Standard Time",
  "asia/ho_chi_minh": "SE Asia Standard Time",
  "asia/hong_kong": "China Standard Time",
  "asia/hovd": "W. Mongolia Standard Time",
  "asia/irkutsk": "North Asia East Standard Time",
  "asia/istanbul": "Turkey Standard Time",
  "asia/jakarta": "SE Asia Standard Time",
  "asia/jayapura": "Tokyo Standard Time",
  "asia/jerusalem": "Israel Standard Time",
  "asia/kabul": "Afghanistan Standard Time",
  "asia/kamchatka": "Russia Time Zone 11",
  "asia/karachi": "Pakistan Standard Time",
  "asia/kashgar": "Central Asia Standard Time",
  "asia/kathmandu": "Nepal Standard Time",
  "asia/katmandu": "Nepal Standard Time",
  "asia/khandyga": "Yakutsk Standard Time",
  "asia/kolkata": "India Standard Time",
  "asia/krasnoyarsk": "North Asia Standard Time",
  "asia/kuala_lumpur": "Singapore Standard Time",
  "asia/kuching": "Singapore Standard Time",
  "asia/kuwait": "Arab Standard Time",
  "asia/macao": "China Standard Time",
  "asia/macau": "China Standard Time",
  "asia/magadan": "Magadan Standard Time",
  "asia/makassar": "Singapore Standard Time",
  "asia/manila": "Singapore Standard Time",
  "asia/muscat": "Arabian Standard Time",
  "asia/nicosia": "GTB Standard Time",
  "asia/novokuznetsk": "North Asia Standard Time",
  "asia/novosibirsk": "N. Central Asia Standard Time",
  "asia/omsk": "Omsk Standard Time",
  "asia/oral": "West Asia Standard Time",
  "asia/phnom_penh": "SE Asia Standard Time",
  "asia/pontianak": "SE Asia Standard Time",
  "asia/pyongyang": "North Korea Standard Time",
  "asia/qatar": "Arab Standard Time",
  "asia/qostanay": "West Asia Standard Time",
  "asia/qyzylorda": "Qyzylorda Standard Time",
  "asia/rangoon": "Myanmar Standard Time",
  "asia/riyadh": "Arab Standard Time",
  "asia/saigon": "SE Asia Standard Time",
  "asia/sakhalin": "Sakhalin Standard Time",
  "asia/samarkand": "West Asia Standard Time",
  "asia/seoul": "Korea Standard Time",
  "asia/shanghai": "China Standard Time",
  "asia/singapore": "Singapore Standard Time",
  "asia/srednekolymsk": "Russia Time Zone 10",
  "asia/taipei": "Taipei Standard Time",
  "asia/tashkent": "West Asia Standard Time",
  "asia/tbilisi": "Georgian Standard Time",
  "asia/tehran": "Iran Standard Time",
  "asia/tel_aviv": "Israel Standard Time",
  "asia/thimbu": "Bangladesh Standard Time",
  "asia/thimphu": "Bangladesh Standard Time",
  "asia/tokyo": "Tokyo Standard Time",
  "asia/tomsk": "Tomsk Standard Time",
  "asia/ujung_pandang": "Singapore Standard Time",
  "asia/ulaanbaatar": "Ulaanbaatar Standard Time",
  "asia/ulan_bator": "Ulaanbaatar Standard Time",
  "asia/urumqi": "Central Asia Standard Time",
  "asia/ust-nera": "Vladivostok Standard Time",
  "asia/vientiane": "SE Asia Standard Time",
  "asia/vladivostok": "Vladivostok Standard Time",
  "asia/yakutsk": "Yakutsk Standard Time",
  "asia/yangon": "Myanmar Standard Time",
  "asia/yekaterinburg": "Ekaterinburg Standard Time",
  "asia/yerevan": "Caucasus Standard Time",
  "atlantic/azores": "Azores Standard Time",
  "atlantic/bermuda": "Atlantic Standard Time",
  "atlantic/canary": "GMT Standard Time",
  "atlantic/cape_verde": "Cape Verde Standard Time",
  "atlantic/faeroe": "GMT Standard Time",
  "atlantic/faroe": "GMT Standard Time",
  "atlantic/jan_mayen": "W. Europe Standard Time",
  "atlantic/madeira": "GMT Standard Time",
  "atlantic/reykjavik": "Greenwich Standard Time",
  "atlantic/south_georgia": "UTC-02",
  "atlantic/st_helena": "Greenwich Standard Time",
  "atlantic/stanley": "SA Eastern Standard Time",
  "australia/act": "AUS Eastern Standard Time",
  "australia/adelaide": "Cen. Australia Standard Time",
  "australia/brisbane": "E. Australia Standard Time",
  "australia/broken_hill": "Cen. Australia Standard Time",
  "australia/canberra": "AUS Eastern Standard Time",
  "australia/currie": "Tasmania Standard Time",
  "australia/darwin": "AUS Central Standard Time",
  "australia/eucla": "Aus Central W. Standard Time",
  "australia/hobart": "Tasmania Standard Time",
  "australia/lhi": "Lord Howe Standard Time",
  "australia/lindeman": "E. Australia Standard Time",
  "australia/lord_howe": "Lord Howe Standard Time",
  "australia/melbourne": "AUS Eastern Standard Time",
  "australia/north": "AUS Central Standard Time",
  "australia/nsw": "AUS Eastern Standard Time",
  "australia/perth": "W. Australia Standard Time",
  "australia/queensland": "E. Australia Standard Time",
  "australia/south": "Cen. Australia Standard Time",
  "australia/sydney": "AUS Eastern Standard Time",
  "australia/tasmania": "Tasmania Standard Time",
  "australia/victoria": "AUS Eastern Standard Time",
  "australia/west": "W. Australia Standard Time",
  "australia/yancowinna": "Cen. Australia Standard Time",
  "brazil/acre": "SA Pacific Standard Time",
  "brazil/denoronha": "UTC-02",
  "brazil/east": "E. South America Standard Time",
  "brazil/west": "SA Western Standard Time",
  "canada/atlantic": "Atlantic Standard Time",
  "canada/central": "Central Standard Time",
  "canada/east-saskatchewan": "Canada Central Standard Time",
  "canada/eastern": "Eastern Standard Time",
  "canada/mountain": "Mountain Standard Time",
  "canada/newfoundland": "Newfoundland Standard Time",
  "canada/pacific": "Pacific Standard Time",
  "canada/saskatchewan": "Canada Central Standard Time",
  "canada/yukon": "Yukon Standard Time",
  "cet": "Romance Standard Time",
  "chile/continental": "Pacific SA Standard Time",
  "chile/easterisland": "Easter Island Standard Time",
  "cst6cdt": "Central Standard Time",
  "cuba": "Cuba Standard Time",
  "eet": "GTB Standard Time",
  "egypt": "Egypt Standard Time",
  "eire": "GMT Standard Time",
  "est": "SA Pacific Standard Time",
  "est5edt": "Eastern Standard Time",
  "etc/gmt": "UTC",
  "etc/gmt+0": "UTC",
  "etc/gmt+1": "Cape Verde Standard Time",
  "etc/gmt+10": "Hawaiian Standard Time",
  "etc/gmt+11": "UTC-11",
  "etc/gmt+12": "Dateline Standard Time",
  "etc/gmt+2": "UTC-02",
  "etc/gmt+3": "SA Eastern Standard Time",
  "etc/gmt+4": "SA Western Standard Time",
  "etc/gmt+5": "SA Pacific Standard Time",
  "etc/gmt+6": "Central America Standard Time",
  "etc/gmt+7": "US Mountain Standard Time",
  "etc/gmt+8": "UTC-08",
  "etc/gmt+9": "UTC-09",
  "etc/gmt-0": "UTC",
  "etc/gmt-1": "W. Central Africa Standard Time",
  "etc/gmt-10": "West Pacific Standard Time",
  "etc/gmt-11": "Central Pacific Standard Time",
  "etc/gmt-12": "UTC+12",
  "etc/gmt-13": "UTC+13",
  "etc/gmt-14": "Line Islands Standard Time",
  "etc/gmt-2": "South Africa Standard Time",
  "etc/gmt-3": "E. Africa Standard Time",
  "etc/gmt-4": "Arabian Standard Time",
  "etc/gmt-5": "West Asia Standard Time",
  "etc/gmt-6": "Central Asia Standard Time",
  "etc/gmt-7": "SE Asia Standard Time",
  "etc/gmt-8": "Singapore Standard Time",
  "etc/gmt-9": "Tokyo Standard Time",
  "etc/gmt0": "UTC",
  "etc/greenwich": "UTC",
  "etc/uct": "UTC",
  "etc/universal": "UTC",
  "etc/utc": "UTC",
  "etc/zulu": "UTC",
  "europe/amsterdam": "W. Europe Standard Time",
  "europe/andorra": "W. Europe Standard Time",
  "europe/astrakhan": "Astrakhan Standard Time",
  "europe/athens": "GTB Standard Time",
  "europe/belfast": "GMT Standard Time",
  "europe/belgrade": "Central Europe Standard Time",
  "europe/berlin": "W. Europe Standard Time",
  "europe/bratislava": "Central Europe Standard Time",
  "europe/brussels": "Romance Standard Time",
  "europe/bucharest": "GTB Standard Time",
  "europe/budapest": "Central Europe Standard Time",
  "europe/busingen": "W. Europe Standard Time",
  "europe/chisinau": "E. Europe Standard Time",
  "europe/copenhagen": "Romance Standard Time",
  "europe/dublin": "GMT Standard Time",
  "europe/gibraltar": "W. Europe Standard Time",
  "europe/guernsey": "GMT Standard Time",
  "europe/helsinki": "FLE Standard Time",
  "europe/isle_of_man": "GMT Standard Time",
  "europe/istanbul": "Turkey Standard Time",
  "europe/jersey": "GMT Standard Time",
  "europe/kaliningrad": "Kaliningrad Standard Time",
  "europe/kiev": "FLE Standard Time",
  "europe/kirov": "Russian Standard Time",
  "europe/kyiv": "FLE Standard Time",
  "europe/lisbon": "GMT Standard Time",
  "europe/ljubljana": "Central Europe Standard Time",
  "europe/london": "GMT Standard Time",
  "europe/luxembourg": "W. Europe Standard Time",
  "europe/madrid": "Romance Standard Time",
  "europe/malta": "W. Europe Standard Time",
  "europe/mariehamn": "FLE Standard Time",
  "europe/minsk": "Belarus Standard Time",
  "europe/monaco": "W. Europe Standard Time",
  "europe/moscow": "Russian Standard Time",
  "europe/nicosia": "GTB Standard Time",
  "europe/oslo": "W. Europe Standard Time",
  "europe/paris": "Romance Standard Time",
  "europe/podgorica": "Central Europe Standard Time",
  "europe/prague": "Central Europe Standard Time",
  "europe/riga": "FLE Standard Time",
  "europe/rome": "W. Europe Standard Time",
  "europe/samara": "Russia Time Zone 3",
  "europe/san_marino": "W. Europe Standard Time",
  "europe/sarajevo": "Central European Standard Time",
  "europe/saratov": "Saratov Standard Time",
  "europe/simferopol": "Russian Standard Time",
  "europe/skopje": "Central European Standard Time",
  "europe/sofia": "FLE Standard Time",
  "europe/stockholm": "W. Europe Standard Time",
  "europe/tallinn": "FLE Standard Time",
  "europe/tirane": "Central Europe Standard Time",
  "europe/tiraspol": "E. Europe Standard Time",
  "europe/ulyanovsk": "Astrakhan Standard Time",
  "europe/uzhgorod": "FLE Standard Time",
  "europe/vaduz": "W. Europe Standard Time",
  "europe/vatican": "W. Europe Standard Time",
  "europe/vienna": "W. Europe Standard Time",
  "europe/vilnius": "FLE Standard Time",
  "europe/volgograd": "Volgograd Standard Time",
  "europe/warsaw": "Central European Standard Time",
  "europe/zagreb": "Central European Standard Time",
  "europe/zaporozhye": "FLE Standard Time",
  "europe/zurich": "W. Europe Standard Time",
  "gb": "GMT Standard Time",
  "gb-eire": "GMT Standard Time",
  "gmt": "UTC",
  "gmt+0": "UTC",
  "gmt-0": "UTC",
  "gmt0": "UTC",
  "greenwich": "UTC",
  "hongkong": "China Standard Time",
  "hst": "Hawaiian Standard Time",
  "iceland": "Greenwich Standard Time",
  "indian/antananarivo": "E. Africa Standard Time",
  "indian/chagos": "Central Asia Standard Time",
  "indian/christmas": "SE Asia Standard Time",
  "indian/cocos": "Myanmar Standard Time",
  "indian/comoro": "E. Africa Standard Time",
  "indian/kerguelen": "West Asia Standard Time",
  "indian/mahe": "Mauritius Standard Time",
  "indian/maldives": "West Asia Standard Time",
  "indian/mauritius": "Mauritius Standard Time",
  "indian/mayotte": "E. Africa Standard Time",
  "indian/reunion": "Mauritius Standard Time",
  "iran": "Iran Standard Time",
  "israel": "Israel Standard Time",
  "jamaica": "SA Pacific Standard Time",
  "japan": "Tokyo Standard Time",
  "kwajalein": "UTC+12",
  "libya": "Libya Standard Time",
  "met": "Romance Standard Time",
  "mexico/bajanorte": "Pacific Standard Time (Mexico)",
  "mexico/bajasur": "Mountain Standard Time (Mexico)",
  "mexico/general": "Central Standard Time (Mexico)",
  "mst": "US Mountain Standard Time",
  "mst7mdt": "Mountain Standard Time",
  "navajo": "Mountain Standard Time",
  "nz": "New Zealand Standard Time",
  "nz-chat": "Chatham Islands Standard Time",
  "pacific/apia": "Samoa Standard Time",
  "pacific/auckland": "New Zealand Standard Time",
  "pacific/bougainville": "Bougainville Standard Time",
  "pacific/chatham": "Chatham Islands Standard Time",
  "pacific/chuuk": "West Pacific Standard Time",
  "pacific/easter": "Easter Island Standard Time",
  "pacific/efate": "Central Pacific Standard Time",
  "pacific/enderbury": "UTC+13",
  "pacific/fakaofo": "UTC+13",
  "pacific/fiji": "Fiji Standard Time",
  "pacific/funafuti": "UTC+12",
  "pacific/galapagos": "Central America Standard Time",
  "pacific/gambier": "UTC-09",
  "pacific/guadalcanal": "Central Pacific Standard Time",
  "pacific/guam": "West Pacific Standard Time",
  "pacific/honolulu": "Hawaiian Standard Time",
  "pacific/johnston": "Hawaiian Standard Time",
  "pacific/kanton": "UTC+13",
  "pacific/kiritimati": "Line Islands Standard Time",
  "pacific/kosrae": "Central Pacific Standard Time",
  "pacific/kwajalein": "UTC+12",
  "pacific/majuro": "UTC+12",
  "pacific/marquesas": "Marquesas Standard Time",
  "pacific/midway": "UTC-11",
  "pacific/nauru": "UTC+12",
  "pacific/niue": "UTC-11",
  "pacific/norfolk": "Norfolk Standard Time",
  "pacific/noumea": "Central Pacific Standard Time",
  "pacific/pago_pago": "UTC-11",
  "pacific/palau": "Tokyo Standard Time",
  "pacific/pitcairn": "UTC-08",
  "pacific/pohnpei": "Central Pacific Standard Time",
  "pacific/ponape": "Central Pacific Standard Time",
  "pacific/port_moresby": "West Pacific Standard Time",
  "pacific/rarotonga": "Hawaiian Standard Time",
  "pacific/saipan": "West Pacific Standard Time",
  "pacific/samoa": "UTC-11",
  "pacific/tahiti": "Hawaiian Standard Time",
  "pacific/tarawa": "UTC+12",
  "pacific/tongatapu": "Tonga Standard Time",
  "pacific/truk": "West Pacific Standard Time",
  "pacific/wake": "UTC+12",
  "pacific/wallis": "UTC+12",
  "pacific/yap": "West Pacific Standard Time",
  "poland": "Central European Standard Time",
  "portugal": "GMT Standard Time",
  "prc": "China Standard Time",
  "pst8pdt": "Pacific Standard Time",
  "roc": "Taipei Standard Time",
  "rok": "Korea Standard Time",
  "singapore": "Singapore Standard Time",
  "turkey": "Turkey Standard Time",
  "uct": "UTC",
  "universal": "UTC",
  "us/alaska": "Alaskan Standard Time",
  "us/aleutian": "Aleutian Standard Time",
  "us/arizona": "US Mountain Standard Time",
  "us/central": "Central Standard Time",
  "us/east-indiana": "US Eastern Standard Time",
  "us/eastern": "Eastern Standard Time",
  "us/hawaii": "Hawaiian Standard Time",
  "us/indiana-starke": "Central Standard Time",
  "us/michigan": "Eastern Standard Time",
  "us/mountain": "Mountain Standard Time",
  "us/pacific": "Pacific Standard Time",
  "us/pacific-new": "Pacific Standard Time",
  "us/samoa": "UTC-11",
  "utc": "UTC",
  "w-su": "Russian Standard Time",
  "wet": "GMT Standard Time",
  "zulu": "UTC"
};

// src/metadata.mjs
var metadataStandard = "metadata-snapshot-land@v1";
var expr = (value) => ({ type: "Expression", value });
var after = (activity) => [{ activity, dependencyConditions: ["Succeeded"] }];
var fail = (name, message) => ({
  name,
  type: "Fail",
  typeProperties: { message, errorCode: "INGESTRON_METADATA_INVALID" }
});
var gate = (name, condition2, message, dependency) => ({
  name,
  type: "IfCondition",
  ...dependency ? { dependsOn: after(dependency) } : {},
  typeProperties: {
    expression: expr(condition2),
    ifTrueActivities: [],
    ifFalseActivities: [fail(`${name}Failed`, message)]
  }
});
function metadataNames(project, group) {
  const base = `${project}_md_${group}`;
  return {
    coordinator: `${base}_run`,
    worker: `${base}_worker`,
    source: `${base}_sql`,
    sink: `${base}_parquet`
  };
}
function metadataGroups(plan) {
  const groups = /* @__PURE__ */ new Map();
  for (const node of plan.nodes) {
    const group = node.with.group;
    const settings = JSON.stringify([
      node.source.kind,
      node.source.linkedService,
      node.with.target.linkedService,
      node.runtime.options?.timeout ?? "00.01:00:00",
      node.with.parallelism ?? 2
    ]);
    if (groups.has(group) && groups.get(group).settings !== settings)
      throw new Error(
        `Metadata group ${group} requires matching source kind, linked services, timeout and parallelism; choose separate groups`
      );
    if (!groups.has(group)) groups.set(group, { settings, nodes: [] });
    groups.get(group).nodes.push(node);
  }
  return [...groups.entries()].sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0);
}
function renderMetadata(plan, add, assets) {
  for (const [group, { nodes }] of metadataGroups(plan)) {
    nodes.sort(
      (a, b) => `${a.flow}/${a.table}` < `${b.flow}/${b.table}` ? -1 : 1
    );
    if (nodes.length > 100)
      throw new Error("Metadata groups support at most 100 tables");
    const first = nodes[0], names = metadataNames(plan.project, group);
    const catalogue = Object.fromEntries(
      nodes.map((n) => [
        `${n.flow}/${n.table}`,
        {
          schema: n.source.schema,
          table: n.source.table,
          query: `SELECT ${n.columns.map((c) => `[${c.name}]`).join(", ")} FROM [${n.source.schema}].[${n.source.table}]`,
          translator: {
            type: "TabularTranslator",
            mappings: n.columns.map((c) => ({
              source: { name: c.name },
              sink: { name: c.target ?? c.name }
            })),
            typeConversion: false
          },
          fileSystem: n.with.target.fileSystem,
          folder: `${n.with.target.path}/${n.flow}/${n.table}`,
          minimumRows: n.with.allowEmpty ? 0 : 1
        }
      ])
    );
    const encoded = JSON.stringify(catalogue);
    if (encoded.length > 2e5)
      throw new Error(
        "Metadata catalogue exceeds 200,000 characters; split the group"
      );
    const variables = { catalogue: { type: "String", defaultValue: encoded } };
    const lookup = "json(variables('catalogue'))[pipeline().parameters.tableId]";
    const policy = {
      timeout: first.runtime.options?.timeout ?? "00.01:00:00",
      retry: 0,
      secureInput: true,
      secureOutput: true
    };
    add("datasets", names.source, {
      type: first.source.kind === "azure-sql" ? "AzureSqlTable" : "SqlServerTable",
      linkedServiceName: {
        type: "LinkedServiceReference",
        referenceName: first.source.linkedService
      },
      parameters: { schema: { type: "String" }, table: { type: "String" } },
      typeProperties: {
        schema: expr("@dataset().schema"),
        table: expr("@dataset().table")
      }
    });
    add("datasets", names.sink, {
      type: "Parquet",
      linkedServiceName: {
        type: "LinkedServiceReference",
        referenceName: first.with.target.linkedService
      },
      parameters: {
        fileSystem: { type: "String" },
        folder: { type: "String" },
        runId: { type: "String" }
      },
      typeProperties: {
        compressionCodec: "snappy",
        location: {
          type: "AzureBlobFSLocation",
          fileSystem: expr("@dataset().fileSystem"),
          folderPath: expr("@concat(dataset().folder, '/', dataset().runId)")
        }
      }
    });
    add(
      "pipelines",
      names.worker,
      {
        description: "Reviewed metadata snapshot worker; consume only successful worker runs",
        concurrency: first.with.parallelism ?? 2,
        variables,
        parameters: {
          tableId: { type: "String" },
          expectedRowCount: { type: "Int" }
        },
        activities: [
          gate(
            "ValidateTable",
            "@contains(json(variables('catalogue')), pipeline().parameters.tableId)",
            "Unknown reviewed table ID"
          ),
          gate(
            "ValidateCount",
            `@and(greaterOrEquals(pipeline().parameters.expectedRowCount, ${lookup}.minimumRows), lessOrEquals(pipeline().parameters.expectedRowCount, 2147483647))`,
            "Invalid expected count or empty-table policy",
            "ValidateTable"
          ),
          {
            name: "Copy",
            type: "Copy",
            dependsOn: after("ValidateCount"),
            policy,
            typeProperties: {
              source: {
                type: first.source.kind === "azure-sql" ? "AzureSqlSource" : "SqlSource",
                sqlReaderQuery: expr(`@${lookup}.query`),
                partitionOption: "None"
              },
              sink: {
                type: "ParquetSink",
                storeSettings: { type: "AzureBlobFSWriteSettings" },
                formatSettings: { type: "ParquetWriteSettings" }
              },
              translator: expr(`@${lookup}.translator`),
              enableStaging: false,
              validateDataConsistency: true,
              enableSkipIncompatibleRow: false
            },
            inputs: [
              {
                type: "DatasetReference",
                referenceName: names.source,
                parameters: {
                  schema: expr(`@${lookup}.schema`),
                  table: expr(`@${lookup}.table`)
                }
              }
            ],
            outputs: [
              {
                type: "DatasetReference",
                referenceName: names.sink,
                parameters: {
                  fileSystem: expr(`@${lookup}.fileSystem`),
                  folder: expr(`@${lookup}.folder`),
                  runId: expr("@pipeline().RunId")
                }
              }
            ]
          },
          gate(
            "VerifyCount",
            "@equals(activity('Copy').output.rowsCopied, pipeline().parameters.expectedRowCount)",
            "Snapshot row count mismatch; do not consume this run",
            "Copy"
          )
        ]
      },
      [names.source, names.sink]
    );
    const filter = (name, condition2, dependency) => ({
      name,
      type: "Filter",
      ...dependency ? { dependsOn: after(dependency) } : {},
      typeProperties: {
        items: expr("@pipeline().parameters.tables"),
        condition: expr(condition2)
      }
    });
    add(
      "pipelines",
      names.coordinator,
      {
        description: "Select reviewed table IDs and independently established counts; no runtime SQL or destination overrides",
        concurrency: 1,
        variables,
        parameters: {
          tables: { type: "Array", defaultValue: Object.keys(catalogue) },
          expectedCounts: { type: "Object" }
        },
        activities: [
          filter(
            "UnknownTables",
            "@not(contains(json(variables('catalogue')), item()))"
          ),
          gate(
            "ValidateSelection",
            "@and(and(greater(length(pipeline().parameters.tables), 0), lessOrEquals(length(pipeline().parameters.tables), 100)), and(equals(length(activity('UnknownTables').output.value), 0), equals(length(union(pipeline().parameters.tables, pipeline().parameters.tables)), length(pipeline().parameters.tables))))",
            "Select 1\u2013100 unique reviewed table IDs",
            "UnknownTables"
          ),
          filter(
            "MissingCounts",
            "@not(contains(pipeline().parameters.expectedCounts, item()))",
            "ValidateSelection"
          ),
          gate(
            "ValidateCountsPresent",
            "@equals(length(activity('MissingCounts').output.value), 0)",
            "Every selected table requires an independently established count",
            "MissingCounts"
          ),
          filter(
            "InvalidCounts",
            "@not(and(equals(string(int(pipeline().parameters.expectedCounts[item()])), string(pipeline().parameters.expectedCounts[item()])), and(greaterOrEquals(int(pipeline().parameters.expectedCounts[item()]), json(variables('catalogue'))[item()].minimumRows), lessOrEquals(int(pipeline().parameters.expectedCounts[item()]), 2147483647))))",
            "ValidateCountsPresent"
          ),
          gate(
            "ValidateCounts",
            "@equals(length(activity('InvalidCounts').output.value), 0)",
            "Counts must be integers within the table policy and 32-bit positive range",
            "InvalidCounts"
          ),
          {
            name: "RunTables",
            type: "ForEach",
            dependsOn: after("ValidateCounts"),
            typeProperties: {
              items: expr("@pipeline().parameters.tables"),
              isSequential: false,
              batchCount: first.with.parallelism ?? 2,
              activities: [
                {
                  name: "RunTable",
                  type: "ExecutePipeline",
                  policy: { secureInput: true },
                  typeProperties: {
                    pipeline: {
                      type: "PipelineReference",
                      referenceName: names.worker
                    },
                    waitOnCompletion: true,
                    parameters: {
                      tableId: expr("@item()"),
                      expectedRowCount: expr(
                        "@int(pipeline().parameters.expectedCounts[item()])"
                      )
                    }
                  }
                }
              ]
            }
          }
        ]
      },
      [],
      [names.worker]
    );
    assets[`metadata/${group}.json`] = {
      format: "json",
      value: {
        apiVersion: "ingestron.adf-metadata/v1",
        group,
        ...names,
        catalogue
      }
    };
    assets[`metadata/${group}.parameters.example.json`] = {
      format: "json",
      value: {
        tables: Object.keys(catalogue),
        expectedCounts: Object.fromEntries(
          Object.keys(catalogue).map((k) => [k, null])
        )
      }
    };
  }
}

// src/temporal-literals.mjs
function temporalLiteral(value, type, dialect) {
  if (typeof value !== "string") return void 0;
  const date = /^(\d{4})-(\d{2})-(\d{2})$/.exec(
    type === "DATE" ? value : value.slice(0, 10)
  );
  if (!date || date[0].length !== (type === "DATE" ? value.length : 10))
    return void 0;
  const year = Number(date[1]), month = Number(date[2]), day = Number(date[3]);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  if (year < (dialect.name === "mysql" ? 1e3 : 1) || year > 9999 || month < 1 || month > 12 || day < 1 || day > days[month - 1])
    return void 0;
  let canonical = value;
  if (type === "TIMESTAMP") {
    const clock = /^\d{4}-\d{2}-\d{2}[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,6}))?$/.exec(
      value
    );
    if (!clock || clock[0].length !== value.length || Number(clock[1]) > 23 || Number(clock[2]) > 59 || Number(clock[3]) > 59)
      return void 0;
    canonical = value.replace("T", " ");
  } else if (type !== "DATE") return void 0;
  if (dialect.name === "tsql")
    return type === "DATE" ? `CONVERT(date, '${canonical.replaceAll("-", "")}', 112)` : `CONVERT(datetime2(6), '${canonical.replace(" ", "T")}', 126)`;
  return `${type} '${canonical}'`;
}

// src/quality.mjs
var METRICS = [
  "nullValues",
  "missingValues",
  "invalidValues",
  "duplicateValues",
  "rowCount"
];
var OPERATORS = [
  "mustBe",
  "mustNotBe",
  "mustBeGreaterThan",
  "mustBeGreaterOrEqualTo",
  "mustBeLessThan",
  "mustBeLessOrEqualTo",
  "mustBeBetween",
  "mustNotBeBetween"
];
var fail2 = (message) => {
  throw new Error(message);
};
function sqlShape(id, text) {
  const stripped = String(text).replace(/N?'(?:[^']|'')*'/g, "''").replace(/\[[^\]]*\]/g, "[]").replace(/`[^`]*`/g, "``").replace(/"[^"]*"/g, '""');
  if (/--|\/\*|;/.test(stripped))
    fail2(`${id}: query must be one statement without comments or semicolons`);
  if (/\b(INSERT|UPDATE|DELETE|MERGE|DROP|CREATE|ALTER|TRUNCATE|GRANT|REVOKE|DENY|EXEC|EXECUTE|CALL|USE|SET|INTO|BACKUP|RESTORE|DBCC|OPENROWSET|OPENQUERY|OPENDATASOURCE|WAITFOR|SHUTDOWN|BULK)\b/i.test(
    stripped
  ))
    fail2(`${id}: query must only read the source table`);
  if (!/^\s*(SELECT|WITH)\b/i.test(stripped))
    fail2(`${id}: a sql rule query must start with SELECT or WITH`);
  return text;
}
function parse(rule, table, column) {
  if (!rule || typeof rule !== "object") return void 0;
  const where = table + (column ? "." + column : "");
  if (rule.type === "sql") {
    const present2 = OPERATORS.filter((o) => rule[o] !== void 0);
    if (present2.length !== 1)
      fail2(`${where}: a sql rule needs exactly one comparison`);
    return {
      id: String(rule.id ?? `${where}.sql`),
      table,
      ...column ? { column } : {},
      metric: "sql",
      query: rule.query,
      operator: present2[0],
      threshold: rule[present2[0]],
      arguments: {},
      unit: "rows",
      outcome: /^error$/i.test(String(rule.severity ?? "")) ? "fail" : "warn",
      source: "contract"
    };
  }
  if ((rule.type ?? "library") !== "library") return void 0;
  if (!METRICS.includes(rule.metric))
    fail2(`${where}: unsupported library metric ${rule.metric}`);
  const present = OPERATORS.filter((o) => rule[o] !== void 0);
  if (present.length !== 1)
    fail2(`${where}: a library rule needs exactly one comparison`);
  return {
    id: String(rule.id ?? `${where}.${rule.metric}`),
    table,
    ...column ? { column } : {},
    metric: rule.metric,
    operator: present[0],
    threshold: rule[present[0]],
    arguments: rule.arguments ?? {},
    unit: rule.unit ?? "rows",
    outcome: /^error$/i.test(String(rule.severity ?? "")) ? "fail" : "warn",
    source: "contract"
  };
}
function contractRules(contract) {
  const object2 = contract.schema?.[0] ?? {};
  const table = String(object2.name ?? "table");
  const rules = [];
  const add = (r) => r && rules.push(r);
  for (const q of contract.quality ?? []) add(parse(q, "*"));
  for (const q of object2.quality ?? []) add(parse(q, table));
  const keys = [];
  for (const p of object2.properties ?? []) {
    for (const q of p.quality ?? []) add(parse(q, table, p.name));
    if (p.primaryKey === true) keys.push(p.name);
  }
  for (const column of keys)
    if (!rules.some((r) => r.column === column && r.metric === "nullValues"))
      rules.push({
        id: `${table}.${column}.key-not-null`,
        table,
        column,
        metric: "nullValues",
        operator: "mustBe",
        threshold: 0,
        arguments: {},
        unit: "rows",
        outcome: "fail",
        source: "primary-key"
      });
  if (keys.length && !rules.some((r) => !r.column && r.metric === "duplicateValues"))
    rules.push({
      id: `${table}.key-unique`,
      table,
      metric: "duplicateValues",
      operator: "mustBe",
      threshold: 0,
      arguments: { properties: keys },
      unit: "rows",
      outcome: "fail",
      source: "primary-key"
    });
  return rules;
}
var dialects = {
  tsql: {
    name: "tsql",
    quote: (n) => "[" + n.replaceAll("]", "]]") + "]",
    count: "COUNT_BIG",
    ifNull: "ISNULL",
    text: (v) => `N'${v.replaceAll("'", "''")}'`,
    alias: " AS d",
    dual: "",
    regex: void 0
  },
  postgres: {
    name: "postgres",
    quote: (n) => `"${n.replaceAll('"', '""')}"`,
    count: "COUNT",
    ifNull: "COALESCE",
    text: (v) => `'${v.replaceAll("'", "''")}'`,
    alias: " AS d",
    dual: "",
    regex: (c, p) => `CAST(${c} AS TEXT) !~ ${p}`
  },
  mysql: {
    name: "mysql",
    quote: (n) => "`" + n.replaceAll("`", "``") + "`",
    count: "COUNT",
    ifNull: "COALESCE",
    text: (v) => `'${v.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`,
    alias: " AS d",
    dual: "",
    regex: (c, p) => `NOT REGEXP_LIKE(${c}, ${p})`
  },
  oracle: {
    name: "oracle",
    quote: (n) => `"${n.replaceAll('"', '""')}"`,
    count: "COUNT",
    ifNull: "COALESCE",
    text: (v) => `'${v.replaceAll("'", "''")}'`,
    // Oracle rejects AS before a table alias and needs a FROM clause.
    alias: " d",
    dual: " FROM DUAL",
    regex: (c, p) => `NOT REGEXP_LIKE(${c}, ${p})`
  }
};
var numeric = (type) => /^(BIGINT|INT|INTEGER|SMALLINT|DOUBLE|FLOAT|DECIMAL)/.test(type);
function literals(values, type, d) {
  return (Array.isArray(values) ? values : []).flatMap(
    (v) => type === "STRING" && typeof v === "string" ? [d.text(v)] : numeric(type) && typeof v === "number" && Number.isFinite(v) ? [String(v)] : ["DATE", "TIMESTAMP"].includes(type) ? temporalLiteral(v, type, d) ? [temporalLiteral(v, type, d)] : [] : type === "BOOLEAN" && typeof v === "boolean" ? [v ? "1" : "0"] : []
  );
}
function measure(rule, column, properties, from, d) {
  const sum = (condition2) => `${d.ifNull}(SUM(CASE WHEN ${condition2} THEN 1 ELSE 0 END), 0)`;
  if (rule.metric === "rowCount") return `${d.count}(*)`;
  if (rule.metric === "duplicateValues") {
    if (column) return `${d.count}(${column}) - ${d.count}(DISTINCT ${column})`;
    return `${d.count}(*) - (SELECT ${d.count}(*) FROM (SELECT DISTINCT ${properties.join(", ")} FROM ${from})${d.alias})`;
  }
  const { name, type } = column;
  const c = d.quote(name);
  if (rule.metric === "nullValues") return sum(`${c} IS NULL`);
  if (rule.metric === "missingValues") {
    const missing = literals(
      rule.arguments.missingValues ?? [null, ""],
      type,
      d
    );
    return sum(
      missing.length ? `${c} IS NULL OR ${c} IN (${missing.join(", ")})` : `${c} IS NULL`
    );
  }
  if (typeof rule.arguments.pattern === "string") {
    if (!d.regex)
      fail2(
        `${rule.id}: SQL Server has no portable regular expressions; use arguments.validValues or a Databricks standard`
      );
    return sum(
      `${c} IS NOT NULL AND ${d.regex(c, d.text(`^(${rule.arguments.pattern})$`).replace(/^N/, ""))}`
    );
  }
  const valid = literals(rule.arguments.validValues, type, d);
  return sum(
    valid.length ? `${c} IS NOT NULL AND ${c} NOT IN (${valid.join(", ")})` : `${c} IS NOT NULL`
  );
}
function qualityRules(contract, columns) {
  const object2 = contract.schema?.[0] ?? {};
  const physical = new Map(
    (object2.properties ?? []).map((p) => [p.name, p.physicalName ?? p.name])
  );
  const byName = new Map(columns.map((c) => [c.name, c]));
  const column = (rule, name) => byName.get(physical.get(name) ?? name) ?? fail2(`${rule.id}: unknown contract column ${name}`);
  return contractRules(contract).map((rule) => {
    if (rule.metric === "sql") {
      passing(rule);
      return {
        id: rule.id,
        metric: "sql",
        query: sqlShape(rule.id, rule.query),
        ...rule.column ? { column: column(rule, rule.column).name } : {},
        operator: rule.operator,
        threshold: rule.threshold,
        unit: "rows",
        outcome: rule.outcome
      };
    }
    if (["nullValues", "missingValues", "invalidValues"].includes(rule.metric) && !rule.column)
      fail2(`${rule.id}: ${rule.metric} needs a column`);
    const properties = (rule.arguments.properties ?? []).map(
      (p) => column(rule, p).name
    );
    if (rule.metric === "duplicateValues" && !rule.column && !properties.length)
      fail2(`${rule.id}: table duplicateValues needs arguments.properties`);
    passing(rule);
    return {
      id: rule.id,
      metric: rule.metric,
      ...rule.column ? { column: column(rule, rule.column).name } : {},
      ...properties.length ? { properties } : {},
      ...rule.arguments.validValues !== void 0 ? { validValues: rule.arguments.validValues } : {},
      ...rule.arguments.missingValues !== void 0 ? { missingValues: rule.arguments.missingValues } : {},
      ...typeof rule.arguments.pattern === "string" ? { pattern: rule.arguments.pattern } : {},
      operator: rule.operator,
      threshold: rule.threshold,
      unit: rule.unit,
      outcome: rule.outcome
    };
  });
}
function qualityQuery(rules, columns, schema, table, dialect = "tsql") {
  const d = dialects[dialect] ?? fail2(`Unsupported SQL dialect ${dialect}`);
  const types = new Map(columns.map((c) => [c.name, c.type]));
  const from = `${d.quote(schema)}.${d.quote(table)}`;
  const selected = rules.map((rule, i) => {
    if (rule.metric === "sql")
      return `(${rule.query.replaceAll("${table}", from).replaceAll(
        "${column}",
        rule.column ? d.quote(rule.column) : "${column}"
      )}) AS q${i}`;
    const target = rule.column ? { name: rule.column, type: types.get(rule.column) } : void 0;
    let value = measure(
      {
        ...rule,
        arguments: {
          validValues: rule.validValues,
          missingValues: rule.missingValues,
          pattern: rule.pattern
        }
      },
      rule.metric === "duplicateValues" && target ? d.quote(target.name) : target,
      (rule.properties ?? []).map(d.quote),
      from,
      d
    );
    if (rule.unit === "percent" && rule.metric !== "rowCount")
      value = `${d.ifNull}(CAST(100.0 * (${value}) / NULLIF(${d.count}(*), 0) AS DECIMAL(9, 4)), 0)`;
    return `(SELECT ${value} FROM ${from}) AS q${i}`;
  });
  return `SELECT ${selected.join(", ")}${d.dual}`;
}
var passing = (c, value = "x") => {
  const t = c.threshold;
  if (c.operator === "mustBeBetween" || c.operator === "mustNotBeBetween") {
    if (!Array.isArray(t) || t.length !== 2 || !t.every(Number.isFinite))
      fail2(`${c.id}: between comparisons need two numeric bounds`);
    const inside = `and(greaterOrEquals(${value}, ${t[0]}), lessOrEquals(${value}, ${t[1]}))`;
    return c.operator === "mustBeBetween" ? inside : `not(${inside})`;
  }
  if (!Number.isFinite(t))
    fail2(`${c.id}: comparison needs a numeric threshold`);
  return {
    mustBe: `equals(${value}, ${t})`,
    mustNotBe: `not(equals(${value}, ${t}))`,
    mustBeGreaterThan: `greater(${value}, ${t})`,
    mustBeGreaterOrEqualTo: `greaterOrEquals(${value}, ${t})`,
    mustBeLessThan: `less(${value}, ${t})`,
    mustBeLessOrEqualTo: `lessOrEquals(${value}, ${t})`
  }[c.operator];
};
function passingExpression(rules) {
  const conditions = rules.flatMap(
    (c, i) => c.outcome === "fail" ? [passing(c, `activity('CheckQuality').output.firstRow.q${i}`)] : []
  );
  if (!conditions.length) return void 0;
  return `@${conditions.reduce((left, right) => `and(${left}, ${right})`)}`;
}

// src/sql-sources.mjs
var sqlSources = {
  "azure-sql": {
    dataset: "AzureSqlTable",
    source: "AzureSqlSource",
    query: "sqlReaderQuery",
    dialect: "tsql",
    options: { partitionOption: "None" },
    table: (s) => ({ schema: s.schema, table: s.table })
  },
  "sql-server": {
    dataset: "SqlServerTable",
    source: "SqlSource",
    query: "sqlReaderQuery",
    dialect: "tsql",
    options: { partitionOption: "None" },
    table: (s) => ({ schema: s.schema, table: s.table })
  },
  postgresql: {
    dataset: "PostgreSqlV2Table",
    source: "PostgreSqlV2Source",
    query: "query",
    dialect: "postgres",
    options: {},
    table: (s) => ({ schema: s.schema, table: s.table })
  },
  mysql: {
    dataset: "MySqlTable",
    source: "MySqlSource",
    query: "query",
    dialect: "mysql",
    options: {},
    // MySQL has no schema below the database; `schema` names the database.
    table: (s) => ({ tableName: s.table })
  },
  oracle: {
    dataset: "OracleTable",
    source: "OracleSource",
    query: "oracleReaderQuery",
    dialect: "oracle",
    options: {},
    table: (s) => ({ schema: s.schema, table: s.table })
  }
};
var sqlKinds = Object.keys(sqlSources);
function selectQuery(kind, columns, schema, table) {
  const { quote: quote2 } = dialects[sqlSources[kind].dialect];
  return `SELECT ${columns.map((c) => quote2(c.name)).join(", ")} FROM ${quote2(schema)}.${quote2(table)}`;
}

// src/schedules.mjs
var check = (ok, message) => {
  if (!ok) throw Error(message);
};
var object = (value) => value && typeof value === "object" && !Array.isArray(value);
var resource = (value) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(value);
var identifier = (value) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]{0,127}$/.test(value);
var instant = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(value);
var expr2 = (value) => ({ type: "Expression", value });
var after2 = (name) => [
  { activity: name, dependencyConditions: ["Succeeded"] }
];
var fail3 = (name, message) => ({
  name,
  type: "Fail",
  typeProperties: { message, errorCode: "INGESTRON_SCHEDULE_INPUT" }
});
var gate2 = (name, condition2, message, dependency) => ({
  name,
  type: "IfCondition",
  ...dependency ? { dependsOn: after2(dependency) } : {},
  typeProperties: {
    expression: expr2(condition2),
    ifTrueActivities: [],
    ifFalseActivities: [fail3(name + "Failed", message)]
  }
});
var compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
var ref = (referenceName, type = "PipelineReference") => ({
  type,
  referenceName
});
var primary = (plan, node) => node.with.standard === metadataStandard ? metadataNames(plan.project, node.with.group).coordinator : `${plan.project}_${node.flow}_${node.table}`;
function adfScheduleFlows(plan) {
  const entries = [];
  for (const flow of plan.flows ?? []) {
    const schedule = flow.schedule;
    if (!schedule) continue;
    check(
      Object.keys(schedule).every(
        (key) => [
          "apiVersion",
          "enabled",
          "timeZone",
          "start",
          "end",
          "recurrence",
          "overlap",
          "missed",
          "daylightSaving"
        ].includes(key)
      ),
      "Unsupported ADF schedule fields"
    );
    check(
      schedule.apiVersion === "ingestron.schedule/v1" && typeof schedule.enabled === "boolean",
      "Use a reviewed flow schedule"
    );
    check(
      schedule.overlap === "native" && schedule.missed === "native" && !schedule.daylightSaving,
      "ADF schedules require explicit native clock, overlap and missed-run policies"
    );
    check(
      !plan.selection?.table && !plan.selection?.step,
      "ADF schedules require the complete flow selection"
    );
    const nodes = plan.nodes.filter((node) => node.flow === flow.id).sort((a, b) => compare(a.table, b.table));
    const tables = Object.keys(flow.tables ?? {}).sort(compare);
    check(
      nodes.length > 0 && nodes.length <= 100 && nodes.length === tables.length && nodes.every((node, index) => node.table === tables[index]),
      "ADF schedules require every reviewed table exactly once"
    );
    const metadata = plan.scheduleBoundaries?.[flow.id];
    check(
      metadata?.apiVersion === "ingestron.schedule-boundaries/v1" && metadata.timeZone === schedule.timeZone && /^[a-f0-9]{64}$/.test(metadata.definitionDigest ?? ""),
      "ADF schedules require compiler-resolved boundary metadata"
    );
    const zone = windowsZones[schedule.timeZone?.toLowerCase()];
    check(zone, "ADF has no pinned Windows mapping for this IANA zone");
    const bound = (value, expected) => {
      check(
        instant(expected) && value?.instant === expected && typeof value.localTime === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/.test(value.localTime),
        "ADF schedule boundary does not match the reviewed UTC instant"
      );
      check(
        value.ambiguous === false && value.possibleInstants?.length === 1 && value.possibleInstants[0].instant === expected && value.possibleInstants[0].offset === value.offset,
        "ADF cannot preserve an ambiguous native wall-clock boundary; review a boundary with one interpretation"
      );
      return zone === "UTC" ? expected : value.localTime;
    };
    const startTime = bound(metadata.start, schedule.start);
    const endTime = schedule.end ? bound(metadata.end, schedule.end) : void 0;
    check(
      !!metadata.end === !!schedule.end,
      "ADF optional end metadata must match the reviewed schedule"
    );
    const clock = {
      startTime,
      ...endTime ? { endTime } : {},
      timeZone: zone
    };
    const recurrence = schedule.recurrence;
    const recurrences = [];
    const fields = recurrence?.kind === "interval" ? ["kind", "minutes"] : recurrence?.kind === "weekly" ? ["kind", "times", "weekDays"] : recurrence?.kind === "monthly" ? ["kind", "times", "monthDays"] : ["kind", "times"];
    check(
      object(recurrence) && Object.keys(recurrence).every((key) => fields.includes(key)),
      "Unsupported ADF recurrence fields"
    );
    if (recurrence?.kind === "interval") {
      check(
        schedule.timeZone === "UTC" && Number.isSafeInteger(recurrence.minutes) && recurrence.minutes > 0,
        "ADF elapsed intervals require literal UTC and whole positive minutes"
      );
      const factor = [
        ["Minute", 1],
        ["Hour", 60],
        ["Day", 1440],
        ["Week", 10080]
      ].find(
        ([, size]) => recurrence.minutes % size === 0 && recurrence.minutes / size <= 1e3
      );
      check(
        factor,
        "ADF cannot represent this elapsed interval exactly within its native multiplier limit"
      );
      recurrences.push({
        ...clock,
        frequency: factor[0],
        interval: recurrence.minutes / factor[1]
      });
    } else {
      check(
        ["daily", "weekly", "monthly"].includes(recurrence?.kind),
        "Unsupported ADF recurrence"
      );
      check(
        Array.isArray(recurrence.times) && recurrence.times.length > 0 && recurrence.times.length <= 100 && new Set(recurrence.times).size === recurrence.times.length && recurrence.times.every(
          (time) => typeof time === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time)
        ),
        "Use exact distinct HH:mm slots"
      );
      let days = {};
      if (recurrence.kind === "weekly") {
        const values = [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday",
          "Saturday",
          "Sunday"
        ];
        check(
          Array.isArray(recurrence.weekDays) && recurrence.weekDays.length > 0 && new Set(recurrence.weekDays).size === recurrence.weekDays.length && recurrence.weekDays.every((day) => values.includes(day)),
          "Use distinct reviewed weekdays"
        );
        days = { weekDays: recurrence.weekDays };
      }
      if (recurrence.kind === "monthly") {
        check(
          Array.isArray(recurrence.monthDays) && recurrence.monthDays.length > 0 && new Set(recurrence.monthDays).size === recurrence.monthDays.length && recurrence.monthDays.every(
            (day) => Number.isInteger(day) && day >= 1 && day <= 31
          ),
          "Use distinct reviewed month days"
        );
        days = { monthDays: recurrence.monthDays };
      }
      for (const slot of [...recurrence.times].sort(compare)) {
        const [hour, minute] = slot.split(":").map(Number);
        recurrences.push({
          ...clock,
          frequency: { daily: "Day", weekly: "Week", monthly: "Month" }[recurrence.kind],
          interval: 1,
          schedule: { hours: [hour], minutes: [minute], ...days }
        });
      }
    }
    const inputs = nodes[0].runtime?.options?.scheduleInputs?.[flow.id];
    check(
      nodes.every(
        (node) => JSON.stringify(node.runtime?.options?.scheduleInputs?.[flow.id]) === JSON.stringify(inputs)
      ),
      "One reviewed schedule input source per flow"
    );
    const needsInputs = nodes.some(
      (node) => [
        "snapshot-land@v1",
        "snapshot-to-databricks@v1",
        metadataStandard
      ].includes(node.with.standard)
    );
    check(
      !needsInputs || object(inputs),
      "Scheduled snapshots require a reviewed source-owner manifest view for fresh expected counts and publication identities"
    );
    if (inputs) {
      check(
        needsInputs,
        "This schedule has no runtime parameters requiring a manifest view"
      );
      check(
        Object.keys(inputs).every(
          (key) => ["kind", "linkedService", "schema", "view"].includes(key)
        ) && ["azure-sql", "sql-server"].includes(inputs.kind) && resource(inputs.linkedService) && identifier(inputs.schema) && identifier(inputs.view),
        "Use a reviewed existing Azure SQL or SQL Server schedule manifest view"
      );
    }
    entries.push({
      flow: flow.id,
      definition: schedule,
      boundaries: metadata,
      nodes,
      recurrences,
      inputs
    });
  }
  return entries;
}
function scheduleManifestQuery(entry) {
  const ids = entry.nodes.map((node) => `${node.flow}/${node.table}`);
  const literal = (value) => "N'" + value.replaceAll("'", "''") + "'";
  const id = "[tableId] COLLATE Latin1_General_100_BIN2";
  const exactId = "([tableId]+N'#') COLLATE Latin1_General_100_BIN2";
  const publication = entry.nodes.some(
    (node) => node.with.standard === "snapshot-to-databricks@v1"
  );
  const fields = "[tableId], [expectedRowCount]" + (publication ? ", [deliveryId], [version], [capturedAt], [initialiseIndex]" : "");
  const invalid = [
    "[expectedRowCount] IS NULL",
    "TRY_CONVERT(int,[expectedRowCount]) IS NULL",
    "[expectedRowCount] <> TRY_CONVERT(int,[expectedRowCount])",
    ...entry.nodes.map(
      (node) => `(${id} = ${literal(`${node.flow}/${node.table}`)} AND [expectedRowCount] < ${node.with.allowEmpty ? 0 : 1})`
    )
  ];
  if (publication)
    invalid.push(
      "[version] IS NULL",
      "TRY_CONVERT(int,[version]) IS NULL",
      "[version] <> TRY_CONVERT(int,[version])",
      "[version] < 1",
      "[deliveryId] IS NULL",
      "LEN([deliveryId]+N'#') NOT BETWEEN 2 AND 129",
      "LEFT([deliveryId],1) COLLATE Latin1_General_100_BIN2 NOT LIKE N'[A-Za-z0-9]'",
      "[deliveryId] COLLATE Latin1_General_100_BIN2 LIKE N'%[^A-Za-z0-9._-]%'",
      "[capturedAt] IS NULL",
      "LEN([capturedAt]+N'#') <> 21",
      "TRY_CONVERT(datetime2(0),[capturedAt],127) IS NULL",
      "CONVERT(nvarchar(19),TRY_CONVERT(datetime2(0),[capturedAt],127),126)+N'Z' <> [capturedAt] COLLATE Latin1_General_100_BIN2",
      "[initialiseIndex] IS NULL",
      "TRY_CONVERT(int,[initialiseIndex]) NOT IN (0,1)",
      "TRY_CONVERT(int,[initialiseIndex]) IS NULL",
      "[initialiseIndex] <> TRY_CONVERT(int,[initialiseIndex])"
    );
  return `WITH [manifest] AS (SELECT TOP (${ids.length + 1}) ${fields} FROM [${entry.inputs.schema}].[${entry.inputs.view}] WHERE ${exactId} IN (${ids.map((value) => literal(value + "#")).join(", ")}))
SELECT [tableId], TRY_CONVERT(int,[expectedRowCount]) AS [expectedRowCount]${publication ? ", [deliveryId], TRY_CONVERT(int,[version]) AS [version], [capturedAt], TRY_CONVERT(bit,[initialiseIndex]) AS [initialiseIndex]" : ""} FROM [manifest]
WHERE (SELECT COUNT_BIG(*) FROM [manifest]) = ${ids.length} AND (SELECT COUNT_BIG(DISTINCT ${id}) FROM [manifest]) = ${ids.length}
AND NOT EXISTS (SELECT 1 FROM [manifest] WHERE ${invalid.join(" OR ")})
ORDER BY CASE ${id} ${ids.map((value, index) => `WHEN ${literal(value)} THEN ${index}`).join(" ")} END`;
}
function renderAdfSchedules(plan, add, assets) {
  const entries = adfScheduleFlows(plan);
  if (!entries.length) return;
  const manifests = [];
  for (const entry of entries) {
    const prefix = `${plan.project}_${entry.flow}_schedule`, dispatch = prefix + "_dispatch", dataset = prefix + "_inputs";
    check(
      resource(dispatch) && resource(dataset),
      "ADF schedule resource name exceeds its native limit"
    );
    check(
      !assets[`pipelines/${dispatch}.json`] && !assets[`datasets/${dataset}.json`],
      "ADF schedule resource collides with an ingestion asset"
    );
    const targets = [
      ...new Set(entry.nodes.map((node) => primary(plan, node)))
    ].sort(compare);
    for (const target of targets)
      check(
        assets[`pipelines/${target}.json`],
        "ADF schedule target is not an owned generated pipeline"
      );
    const bounds = `greaterOrEquals(ticks(pipeline().parameters.scheduledTime),ticks('${entry.definition.start}'))`;
    const window = entry.definition.end ? `and(${bounds},less(ticks(pipeline().parameters.scheduledTime),ticks('${entry.definition.end}')))` : bounds;
    const activities = [
      gate2(
        "CheckScheduleWindow",
        "@" + window,
        "Scheduled occurrence is outside the reviewed UTC bounds; no source read or copy is allowed"
      )
    ];
    const policy = {
      timeout: entry.nodes[0].runtime.options?.timeout ?? "00.01:00:00",
      retry: 0,
      secureInput: true,
      secureOutput: true
    };
    let dependency = "CheckScheduleWindow";
    if (entry.inputs) {
      const sql = sqlSources[entry.inputs.kind];
      add("datasets", dataset, {
        type: sql.dataset,
        linkedServiceName: ref(
          entry.inputs.linkedService,
          "LinkedServiceReference"
        ),
        typeProperties: {
          schema: entry.inputs.schema,
          table: entry.inputs.view
        }
      });
      activities.push({
        name: "ScheduleInputs",
        type: "Lookup",
        dependsOn: after2(dependency),
        policy,
        typeProperties: {
          source: {
            type: sql.source,
            [sql.query]: scheduleManifestQuery(entry),
            ...sql.options
          },
          dataset: ref(dataset, "DatasetReference"),
          firstRowOnly: false
        }
      });
      activities.push(
        gate2(
          "CheckScheduleInputs",
          `@equals(length(activity('ScheduleInputs').output.value),${entry.nodes.length})`,
          "Source-owner schedule manifest is missing, duplicated or invalid; nothing was copied",
          "ScheduleInputs"
        )
      );
      dependency = "CheckScheduleInputs";
    }
    const invoke = (name, parameters, index) => ({
      name: "Invoke" + index,
      type: "ExecutePipeline",
      policy: { secureInput: true },
      typeProperties: {
        pipeline: ref(name),
        waitOnCompletion: true,
        parameters
      }
    });
    if (entry.nodes.every((node) => node.with.standard === metadataStandard)) {
      for (const [index, target] of targets.entries()) {
        const members = entry.nodes.filter(
          (node) => primary(plan, node) === target
        );
        const pieces = [];
        for (const node of members) {
          const ordinal = entry.nodes.indexOf(node), key = `${node.flow}/${node.table}`;
          pieces.push(
            `'${pieces.length ? "," : ""}${JSON.stringify(key)}:'`,
            `string(activity('ScheduleInputs').output.value[${ordinal}].expectedRowCount)`
          );
        }
        const counts = expr2("@json(concat('{'," + pieces.join(",") + ",'}'))");
        activities.push({
          ...invoke(
            target,
            {
              tables: members.map((node) => `${node.flow}/${node.table}`),
              expectedCounts: counts
            },
            index
          ),
          dependsOn: after2(dependency)
        });
      }
    } else {
      const cases = entry.nodes.map((node, index) => {
        const target = primary(plan, node), declared = assets[`pipelines/${target}.json`].value.properties.parameters ?? {};
        const parameters = {};
        for (const key of Object.keys(declared)) {
          check(
            [
              "expectedRowCount",
              "deliveryId",
              "version",
              "capturedAt",
              "initialiseIndex"
            ].includes(key),
            "No reviewed schedule input binding for pipeline parameter " + key
          );
          check(
            entry.inputs,
            "A schedule input manifest is required for pipeline parameters"
          );
          parameters[key] = expr2(
            ["version", "expectedRowCount"].includes(key) ? `@int(item().${key})` : `@item().${key}`
          );
        }
        return {
          value: `${node.flow}/${node.table}`,
          activities: [invoke(target, parameters, index)]
        };
      });
      const switches = [];
      for (let index = 0; index < cases.length; index += 25)
        switches.push({
          name: "SelectTable" + index,
          type: "Switch",
          typeProperties: {
            on: expr2("@item().tableId"),
            cases: cases.slice(index, index + 25),
            defaultActivities: []
          }
        });
      const items = entry.inputs ? "@activity('ScheduleInputs').output.value" : "@json('" + JSON.stringify(
        entry.nodes.map((node) => ({
          tableId: `${node.flow}/${node.table}`
        }))
      ) + "')";
      activities.push({
        name: "RunReviewedTables",
        type: "ForEach",
        dependsOn: after2(dependency),
        typeProperties: {
          items: expr2(items),
          isSequential: false,
          batchCount: 20,
          activities: switches
        }
      });
    }
    add(
      "pipelines",
      dispatch,
      {
        concurrency: 1,
        parameters: { scheduledTime: { type: "String" } },
        activities
      },
      entry.inputs ? [dataset] : [],
      targets
    );
    const triggers = [];
    for (const [index, recurrence] of entry.recurrences.entries()) {
      const name = prefix + "_" + String(index + 1).padStart(3, "0");
      check(resource(name), "ADF trigger name exceeds its native limit");
      check(!assets[`triggers/${name}.json`], "ADF trigger resource collision");
      const properties = {
        type: "ScheduleTrigger",
        typeProperties: { recurrence },
        pipelines: [
          {
            pipelineReference: ref(dispatch),
            parameters: { scheduledTime: "@trigger().scheduledTime" }
          }
        ]
      };
      add("triggers", name, properties, [], [dispatch]);
      triggers.push({ name, file: `triggers/${name}.json`, properties });
    }
    manifests.push({
      flow: entry.flow,
      definition: entry.definition,
      boundaries: entry.boundaries,
      inputSource: entry.inputs ?? null,
      tables: entry.nodes.map((node) => `${node.flow}/${node.table}`),
      targets,
      dispatch: {
        name: dispatch,
        file: `pipelines/${dispatch}.json`,
        properties: assets[`pipelines/${dispatch}.json`].value.properties
      },
      triggers,
      status: "not-created",
      activationIntent: entry.definition.enabled ? "Started" : "Stopped"
    });
  }
  assets["adf-schedules.json"] = {
    format: "json",
    value: {
      apiVersion: "ingestron.adf-schedules/v1",
      project: plan.project,
      planDigest: plan.digest,
      execution: "not-run",
      clock: "native-unqualified",
      schedules: manifests
    }
  };
  assets["SCHEDULES.md"] = {
    format: "text",
    value: "# Reviewed ADF schedules\n\nReview adf-schedules.json, each trigger, the UTC dispatch guard and any source-owner manifest view. Generation makes no API call. New triggers require separately authorised activation; an existing trigger may already be running and must be reconciled separately. Native clock, overlap and missed-run behaviour are explicitly delegated and unqualified. Invalid inputs fail before dispatch; source extracts and manifest views must remain frozen together. Never trigger recovery or metadata worker pipelines directly. Generated UTC bounds are enforced against the scheduled occurrence, including an exclusive end. No cancellation or scheduled-execution qualification is claimed.\n"
  };
}

// src/watermark-control.mjs
var watermarkControlSql = `-- Ingestron native append checkpoint and committed-delivery journal, protocol v1.
-- Apply through independently reviewed deployment to a dedicated control database.
-- Grant the pipeline EXECUTE on these procedures; journal consumers need SELECT only.
-- Existing state is never reset. Failed landing folders are never journal publications.
SET XACT_ABORT ON;
IF OBJECT_ID(N'dbo.IngestronWatermarkV1', N'U') IS NULL
BEGIN
 CREATE TABLE dbo.IngestronWatermarkV1 (
  Dataset nvarchar(400) COLLATE Latin1_General_100_BIN2 NOT NULL PRIMARY KEY,
  PlanDigest char(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  Watermark bigint NOT NULL CHECK (Watermark >= 0)
 );
END;
IF OBJECT_ID(N'dbo.IngestronDeliveryV1', N'U') IS NULL
BEGIN
 CREATE TABLE dbo.IngestronDeliveryV1 (
  Dataset nvarchar(400) COLLATE Latin1_General_100_BIN2 NOT NULL,
  RunId uniqueidentifier NOT NULL,
  PlanDigest char(64) COLLATE Latin1_General_100_BIN2 NOT NULL,
  LowerWatermark bigint NOT NULL,
  UpperWatermark bigint NOT NULL,
  [RowCount] int NOT NULL CHECK ([RowCount] > 0 AND [RowCount] <= 1000000),
  LandingPath nvarchar(1000) COLLATE Latin1_General_100_BIN2 NOT NULL,
  CommittedAt datetime2(7) NOT NULL DEFAULT SYSUTCDATETIME(),
  PRIMARY KEY (Dataset, RunId),
  FOREIGN KEY (Dataset) REFERENCES dbo.IngestronWatermarkV1(Dataset),
  CHECK (LowerWatermark >= 0 AND UpperWatermark > LowerWatermark)
 );
END;
GO
CREATE OR ALTER PROCEDURE dbo.IngestronReadWatermarkV1
 @Dataset nvarchar(max), @PlanDigest varchar(max), @Initial varchar(max)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @InitialValue bigint = TRY_CONVERT(bigint, @Initial);
 IF @InitialValue IS NULL OR @InitialValue < 0 OR @Initial IS NULL
  OR DATALENGTH(@Initial) <> DATALENGTH(CONVERT(varchar(20), @InitialValue))
  OR @Initial COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @InitialValue)
  THROW 51000, 'Initial watermark must be a canonical non-negative int64 string', 1;
 IF @Dataset IS NULL OR DATALENGTH(@Dataset) = 0 OR DATALENGTH(@Dataset) > 800
  OR @Dataset COLLATE Latin1_General_100_BIN2 LIKE N'%[^a-zA-Z0-9_.-]%'
  THROW 51001, 'Invalid checkpoint dataset identity', 1;
 IF @PlanDigest IS NULL OR DATALENGTH(@PlanDigest) <> 64
  OR @PlanDigest COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9a-f]%'
  THROW 51002, 'Invalid plan identity', 1;
 BEGIN TRY
  BEGIN TRANSACTION;
  DECLARE @StoredDigest char(64), @Value bigint;
  SELECT @StoredDigest = PlanDigest, @Value = Watermark
   FROM dbo.IngestronWatermarkV1 WITH (UPDLOCK, HOLDLOCK) WHERE Dataset = @Dataset;
  IF @StoredDigest IS NULL
  BEGIN
   INSERT dbo.IngestronWatermarkV1 (Dataset, PlanDigest, Watermark) VALUES (@Dataset, @PlanDigest, @InitialValue);
   SET @StoredDigest = @PlanDigest; SET @Value = @InitialValue;
  END;
  IF @StoredDigest COLLATE Latin1_General_100_BIN2 <> @PlanDigest COLLATE Latin1_General_100_BIN2
   THROW 51003, 'Checkpoint plan changed; review a separate state namespace or an explicit migration', 1;
  COMMIT TRANSACTION;
  SELECT CONVERT(varchar(20), @Value) AS watermark;
 END TRY
 BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
CREATE OR ALTER PROCEDURE dbo.IngestronValidateBatchV1
 @Dataset nvarchar(max), @PlanDigest varchar(max),
 @Expected varchar(max), @Next varchar(max), @RunId varchar(max)
AS
BEGIN
 SET NOCOUNT ON;
 DECLARE @Low bigint = TRY_CONVERT(bigint, @Expected), @High bigint = TRY_CONVERT(bigint, @Next),
  @Run uniqueidentifier = TRY_CONVERT(uniqueidentifier, @RunId);
 IF @Low IS NULL OR @High IS NULL OR @Low < 0 OR @High <= @Low
  OR DATALENGTH(@Expected) <> DATALENGTH(CONVERT(varchar(20), @Low))
  OR DATALENGTH(@Next) <> DATALENGTH(CONVERT(varchar(20), @High))
  OR @Expected COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @Low)
  OR @Next COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @High)
  THROW 51004, 'Invalid canonical batch interval', 1;
 IF @Run IS NULL OR DATALENGTH(@RunId) <> 36
  OR @RunId COLLATE Latin1_General_100_BIN2 <> LOWER(CONVERT(varchar(36), @Run)) COLLATE Latin1_General_100_BIN2
  THROW 51005, 'Invalid canonical pipeline run identity', 1;
 IF @Dataset IS NULL OR DATALENGTH(@Dataset) = 0 OR DATALENGTH(@Dataset) > 800
  OR @Dataset COLLATE Latin1_General_100_BIN2 LIKE N'%[^a-zA-Z0-9_.-]%'
  OR @PlanDigest IS NULL OR DATALENGTH(@PlanDigest) <> 64
  OR @PlanDigest COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9a-f]%'
  THROW 51006, 'Invalid batch dataset or plan identity', 1;
 IF NOT EXISTS (SELECT 1 FROM dbo.IngestronWatermarkV1 WHERE Dataset = @Dataset
  AND PlanDigest = @PlanDigest AND Watermark = @Low)
  THROW 51007, 'Checkpoint changed; this batch cannot start', 1;
 SELECT CONVERT(varchar(20), @Low) AS lowerWatermark, CONVERT(varchar(20), @High) AS upperWatermark,
  LOWER(CONVERT(varchar(36), @Run)) AS runId;
END;
GO
CREATE OR ALTER PROCEDURE dbo.IngestronCommitWatermarkV1
 @Dataset nvarchar(max), @RunId varchar(max), @PlanDigest varchar(max),
 @Expected varchar(max), @Next varchar(max), @RowCount int, @LandingPath nvarchar(max)
AS
BEGIN
 SET NOCOUNT ON; SET XACT_ABORT ON;
 DECLARE @Low bigint = TRY_CONVERT(bigint, @Expected), @High bigint = TRY_CONVERT(bigint, @Next),
  @Run uniqueidentifier = TRY_CONVERT(uniqueidentifier, @RunId);
 IF @Low IS NULL OR @High IS NULL OR @Low < 0 OR @High <= @Low
  OR @RowCount IS NULL OR @RowCount <= 0 OR @RowCount > 1000000
  OR DATALENGTH(@Expected) <> DATALENGTH(CONVERT(varchar(20), @Low))
  OR DATALENGTH(@Next) <> DATALENGTH(CONVERT(varchar(20), @High))
  OR @Expected COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @Low)
  OR @Next COLLATE Latin1_General_100_BIN2 <> CONVERT(varchar(20), @High)
  THROW 51008, 'Invalid bounded checkpoint transition', 1;
 IF @Run IS NULL OR DATALENGTH(@RunId) <> 36
  OR @RunId COLLATE Latin1_General_100_BIN2 <> LOWER(CONVERT(varchar(36), @Run)) COLLATE Latin1_General_100_BIN2
  OR @LandingPath IS NULL OR DATALENGTH(@LandingPath) = 0 OR DATALENGTH(@LandingPath) > 2000
  THROW 51009, 'A canonical delivery identity and bounded landing location are required', 1;
 IF @Dataset IS NULL OR DATALENGTH(@Dataset) = 0 OR DATALENGTH(@Dataset) > 800
  OR @Dataset COLLATE Latin1_General_100_BIN2 LIKE N'%[^a-zA-Z0-9_.-]%'
  OR @PlanDigest IS NULL OR DATALENGTH(@PlanDigest) <> 64
  OR @PlanDigest COLLATE Latin1_General_100_BIN2 LIKE '%[^0-9a-f]%'
  THROW 51010, 'Invalid delivery dataset or plan identity', 1;
 BEGIN TRY
  BEGIN TRANSACTION;
  -- Always lock the dataset before its receipts so concurrent writers use the same lock order.
  DECLARE @StoredDigest char(64), @Value bigint;
  SELECT @StoredDigest = PlanDigest, @Value = Watermark
   FROM dbo.IngestronWatermarkV1 WITH (UPDLOCK, HOLDLOCK) WHERE Dataset = @Dataset;
  IF @StoredDigest IS NULL OR @StoredDigest COLLATE Latin1_General_100_BIN2 <> @PlanDigest COLLATE Latin1_General_100_BIN2
   THROW 51011, 'Checkpoint identity changed or was not initialised', 1;
  IF EXISTS (SELECT 1 FROM dbo.IngestronDeliveryV1 WHERE Dataset = @Dataset AND RunId = @Run)
  BEGIN
   IF NOT EXISTS (SELECT 1 FROM dbo.IngestronDeliveryV1 WHERE Dataset = @Dataset AND RunId = @Run
     AND PlanDigest = @PlanDigest AND LowerWatermark = @Low AND UpperWatermark = @High
     AND [RowCount] = @RowCount AND LandingPath = @LandingPath
     AND DATALENGTH(LandingPath) = DATALENGTH(@LandingPath))
    THROW 51012, 'Run identity was already committed with different evidence', 1;
   COMMIT TRANSACTION; RETURN;
  END;
  IF @Value <> @Low
   THROW 51013, 'Another run already advanced the checkpoint; this landing is unpublished', 1;
  UPDATE dbo.IngestronWatermarkV1 SET Watermark = @High WHERE Dataset = @Dataset AND PlanDigest = @PlanDigest AND Watermark = @Low;
  IF @@ROWCOUNT <> 1 THROW 51014, 'Checkpoint changed before commit', 1;
  INSERT dbo.IngestronDeliveryV1 (Dataset,RunId,PlanDigest,LowerWatermark,UpperWatermark,[RowCount],LandingPath)
   VALUES (@Dataset,@Run,@PlanDigest,@Low,@High,@RowCount,@LandingPath);
  COMMIT TRANSACTION;
 END TRY
 BEGIN CATCH
  IF XACT_STATE() <> 0 ROLLBACK TRANSACTION;
  THROW;
 END CATCH;
END;
GO
`;

// src/watermark.mjs
var watermarkStandard = "watermark-append-land@v1";
var check2 = (ok, message) => {
  if (!ok) throw new Error(message);
};
var ident = (value) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
var resource2 = (value) => typeof value === "string" && /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(value);
var strict = (value, keys, label) => check2(
  value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).every((key) => keys.includes(key)),
  `Unsupported ${label} settings`
);
var quote = (value) => `[${value}]`;
var expression = (value) => ({ type: "Expression", value });
var reference = (name, type = "DatasetReference") => ({
  referenceName: name,
  type
});
var depends = (name) => [
  { activity: name, dependencyConditions: ["Succeeded"] }
];
var fail4 = (name, message) => ({
  name,
  type: "Fail",
  typeProperties: { errorCode: "IngestronCheckpoint", message }
});
var condition = (name, value, yes, no, message) => ({
  name,
  type: "IfCondition",
  dependsOn: depends(no),
  typeProperties: {
    expression: expression(value),
    ifTrueActivities: yes,
    ifFalseActivities: [fail4(name + "Rejected", message)]
  }
});
var maximum = "9223372036854775807";
function validateWatermark(plan, node) {
  const source = node.source, settings = node.with.watermark;
  check2(
    [
      `${plan.project}_${node.flow}_${node.table}_source`,
      `${plan.project}_${node.flow}_${node.table}_landing`,
      `${plan.project}_${node.flow}_${node.table}_control`,
      `${plan.project}_${node.flow}_${node.table}_batch`
    ].every(resource2),
    "Generated native watermark resource names exceed the supported bound"
  );
  strict(
    settings,
    [
      "column",
      "initial",
      "batchSize",
      "namespace",
      "consistency",
      "controlLinkedService"
    ],
    "watermark"
  );
  strict(
    source,
    ["kind", "linkedService", "schema", "table", "consistency"],
    "watermark SQL source"
  );
  check2(
    ["sql-server", "azure-sql"].includes(source.kind),
    "Native append watermark supports SQL Server and Azure SQL"
  );
  check2(
    resource2(source.linkedService) && ident(source.schema) && ident(source.table),
    "Use explicit safe SQL source identifiers"
  );
  check2(
    settings.consistency === "ordered-committed-append" && source.consistency === "ordered-committed-append",
    "A committed ordered immutable append source promise is required"
  );
  check2(
    ident(settings.column) && resource2(settings.namespace) && resource2(settings.controlLinkedService),
    "A safe watermark column, explicit state namespace and existing control linked service are required"
  );
  check2(
    typeof settings.initial === "string" && /^(0|[1-9][0-9]{0,18})$/.test(settings.initial) && (settings.initial.length < maximum.length || settings.initial <= maximum),
    "Initial watermark must be a canonical non-negative signed int64 string"
  );
  check2(
    Number.isInteger(settings.batchSize) && settings.batchSize >= 1 && settings.batchSize <= 1e6,
    "Batch size must be an integer between 1 and 1000000"
  );
  const keys = node.columns.filter((column) => column.key);
  check2(
    keys.length === 1 && keys[0].name === settings.column && keys[0].required && ["BIGINT", "INT", "INTEGER", "SMALLINT"].includes(keys[0].type),
    "Select the sole required integer contract primary key as watermark"
  );
  check2(
    node.columns.every(
      (column) => ident(column.name) && ident(column.target ?? column.name) && column.type !== "BINARY"
    ),
    "Reviewed native contract columns are required"
  );
  check2(
    !node.with.quality?.some(
      (rule) => rule.metric === "sql" || rule.pattern !== void 0
    ),
    "Native append quality uses bounded library rules; custom SQL and pattern rules are unsupported"
  );
  check2(
    node.with.allowEmpty === void 0 && node.with.handover === void 0 && node.with.publication === void 0,
    "Watermark publication uses its committed delivery journal"
  );
  check2(
    /^[a-f0-9]{64}$/.test(plan.digest ?? ""),
    "A reviewed exact plan digest is required for checkpoint fencing"
  );
  const key = [
    settings.namespace,
    plan.project,
    plan.environment,
    node.flow,
    node.table
  ].join(".");
  check2(
    key.length <= 400 && /^[A-Za-z0-9_.-]+$/.test(key),
    "Checkpoint dataset identity exceeds its supported bound"
  );
  return key;
}
function sqlExpression(sql, worker = false) {
  const parts = sql.split(/(\{LOW\}|\{HIGH\})/).filter(Boolean).map(
    (part) => part === "{LOW}" ? worker ? "activity('ValidateBatch').output.firstRow.lowerWatermark" : "activity('ReadWatermark').output.firstRow.watermark" : part === "{HIGH}" ? worker ? "activity('ValidateBatch').output.firstRow.upperWatermark" : "activity('ChooseUpper').output.firstRow.watermark" : `'${part.replaceAll("'", "''")}'`
  );
  return expression(`@concat(${parts.join(", ")})`);
}
function renderWatermark(plan, node, add, assets) {
  const key = validateWatermark(plan, node), s = node.source, w = node.with, state = w.watermark, target = w.target;
  const name = `${plan.project}_${node.flow}_${node.table}`, src = name + "_source", sink = name + "_landing", control = name + "_control", worker = name + "_batch";
  const policy = {
    timeout: node.runtime.options?.timeout ?? "00.01:00:00",
    retry: 0,
    secureInput: true,
    secureOutput: true
  };
  const sqlType = s.kind === "azure-sql" ? "AzureSqlSource" : "SqlSource";
  const table = `${quote(s.schema)}.${quote(s.table)}`;
  const cursor = quote(state.column);
  const window = `${cursor} > CAST({LOW} AS BIGINT) AND ${cursor} <= CAST({HIGH} AS BIGINT)`;
  const scoped = `(SELECT * FROM ${table} WHERE ${window}) AS [ingestron_batch]`;
  const lookup = (name2, dataset, query, after3, sourceType = sqlType) => ({
    name: name2,
    type: "Lookup",
    ...after3 ? { dependsOn: depends(after3) } : {},
    policy,
    typeProperties: {
      source: {
        type: sourceType,
        sqlReaderQuery: query,
        partitionOption: "None"
      },
      dataset: reference(dataset),
      firstRowOnly: true
    }
  });
  add("datasets", src, {
    type: s.kind === "azure-sql" ? "AzureSqlTable" : "SqlServerTable",
    linkedServiceName: reference(s.linkedService, "LinkedServiceReference"),
    typeProperties: { schema: s.schema, table: s.table }
  });
  add("datasets", control, {
    type: "AzureSqlTable",
    linkedServiceName: reference(
      state.controlLinkedService,
      "LinkedServiceReference"
    ),
    typeProperties: { schema: "dbo", table: "IngestronWatermarkV1" }
  });
  add("datasets", sink, {
    type: "Parquet",
    linkedServiceName: reference(
      target.linkedService,
      "LinkedServiceReference"
    ),
    parameters: { runId: { type: "String" } },
    typeProperties: {
      location: {
        type: "AzureBlobFSLocation",
        fileSystem: target.fileSystem,
        folderPath: expression(
          `@concat('${target.path}/${node.flow}/${node.table}/', dataset().runId)`
        )
      },
      compressionCodec: "snappy"
    }
  });
  const read = lookup(
    "ReadWatermark",
    control,
    `EXEC dbo.IngestronReadWatermarkV1 @Dataset = N'${key}', @PlanDigest = '${plan.digest}', @Initial = '${state.initial}'`,
    void 0,
    "AzureSqlSource"
  );
  const pkQuery = `SELECT CASE WHEN (SELECT COUNT(*) FROM sys.index_columns ic JOIN sys.indexes i ON i.object_id=ic.object_id AND i.index_id=ic.index_id WHERE i.is_primary_key=1 AND ic.object_id=OBJECT_ID(N'${table}') AND ic.key_ordinal>0)=1 AND EXISTS(SELECT 1 FROM sys.columns c JOIN sys.index_columns ic ON ic.object_id=c.object_id AND ic.column_id=c.column_id JOIN sys.indexes i ON i.object_id=ic.object_id AND i.index_id=ic.index_id WHERE c.object_id=OBJECT_ID(N'${table}') AND c.name=N'${state.column}' AND c.is_nullable=0 AND c.system_type_id IN(48,52,56,127) AND i.is_primary_key=1 AND ic.key_ordinal=1) THEN 1 ELSE 0 END AS valid`;
  const pk = lookup("ValidateSourceKey", src, pkQuery, "ReadWatermark");
  const pkGate = condition(
    "RequireSourceKey",
    "@equals(activity('ValidateSourceKey').output.firstRow.valid, 1)",
    [],
    "ValidateSourceKey",
    "The physical source must have the sole non-null integer primary key selected by the reviewed contract"
  );
  const upper = lookup(
    "ChooseUpper",
    src,
    sqlExpression(
      `SELECT COALESCE(CONVERT(varchar(20),MAX(${cursor})), '{LOW}') AS watermark FROM (SELECT TOP (${state.batchSize}) ${cursor} FROM ${table} WHERE ${cursor} > CAST({LOW} AS BIGINT) ORDER BY ${cursor}) AS [ordered_batch]`
    ),
    "RequireSourceKey"
  );
  const quality = w.quality ?? [];
  const parameter = (value, type = "String") => ({ value, type });
  const validateBatch = lookup(
    "ValidateBatch",
    control,
    void 0,
    void 0,
    "AzureSqlSource"
  );
  delete validateBatch.typeProperties.source.sqlReaderQuery;
  Object.assign(validateBatch.typeProperties.source, {
    sqlReaderStoredProcedureName: "dbo.IngestronValidateBatchV1",
    storedProcedureParameters: {
      Dataset: parameter(key),
      PlanDigest: parameter(plan.digest),
      Expected: parameter(expression("@pipeline().parameters.lowerWatermark")),
      Next: parameter(expression("@pipeline().parameters.upperWatermark")),
      RunId: parameter(expression("@pipeline().parameters.runId"))
    }
  });
  const workerPk = lookup("ValidateSourceKey", src, pkQuery, "ValidateBatch");
  const qualitySql = quality.length ? qualityQuery(quality, node.columns, s.schema, s.table).slice("SELECT ".length).replaceAll(table, scoped) : "";
  const metrics = lookup(
    "CheckQuality",
    src,
    sqlExpression(
      `SELECT COUNT(*) AS [rowCount]${qualitySql ? ", " + qualitySql : ""} FROM ${scoped}`,
      true
    ),
    "RequireSourceKey"
  );
  const passes = passingExpression(quality);
  const qualityGate = condition(
    "RequireQuality",
    `@and(and(greater(activity('CheckQuality').output.firstRow.rowCount, 0), lessOrEquals(activity('CheckQuality').output.firstRow.rowCount, ${state.batchSize})), ${passes ? passes.slice(1) : "equals(1, 1)"})`,
    [],
    "CheckQuality",
    "Source batch failed the reviewed quality rules"
  );
  const copy = {
    name: "Copy",
    type: "Copy",
    dependsOn: depends("RequireQuality"),
    policy,
    typeProperties: {
      source: {
        type: sqlType,
        sqlReaderQuery: sqlExpression(
          `SELECT ${node.columns.map((c) => quote(c.name)).join(", ")} FROM ${table} WHERE ${window}`,
          true
        ),
        partitionOption: "None"
      },
      sink: {
        type: "ParquetSink",
        storeSettings: { type: "AzureBlobFSWriteSettings" },
        formatSettings: { type: "ParquetWriteSettings" }
      },
      enableStaging: false,
      validateDataConsistency: true,
      enableSkipIncompatibleRow: false,
      translator: {
        type: "TabularTranslator",
        typeConversion: false,
        mappings: node.columns.map((c) => ({
          source: { name: c.name },
          sink: { name: c.target ?? c.name }
        }))
      }
    },
    inputs: [reference(src)],
    outputs: [
      {
        ...reference(sink),
        parameters: {
          runId: expression("@activity('ValidateBatch').output.firstRow.runId")
        }
      }
    ]
  };
  const commit = {
    name: "CommitWatermark",
    type: "SqlServerStoredProcedure",
    policy,
    linkedServiceName: reference(
      state.controlLinkedService,
      "LinkedServiceReference"
    ),
    typeProperties: {
      storedProcedureName: "dbo.IngestronCommitWatermarkV1",
      storedProcedureParameters: {
        Dataset: parameter(key),
        RunId: parameter(
          expression("@activity('ValidateBatch').output.firstRow.runId")
        ),
        PlanDigest: parameter(plan.digest),
        Expected: parameter(
          expression(
            "@activity('ValidateBatch').output.firstRow.lowerWatermark"
          )
        ),
        Next: parameter(
          expression(
            "@activity('ValidateBatch').output.firstRow.upperWatermark"
          )
        ),
        RowCount: parameter(
          expression("@activity('CheckQuality').output.firstRow.rowCount"),
          "Int32"
        ),
        LandingPath: parameter(
          expression(
            `@concat('${target.fileSystem}/${target.path}/${node.flow}/${node.table}/', activity('ValidateBatch').output.firstRow.runId)`
          )
        )
      }
    }
  };
  const copied = condition(
    "VerifyCount",
    "@and(equals(activity('Copy').output.rowsRead, activity('CheckQuality').output.firstRow.rowCount), equals(activity('Copy').output.rowsCopied, activity('CheckQuality').output.firstRow.rowCount))",
    [commit],
    "Copy",
    "Copied rows differ from the bounded source batch; checkpoint and publication are unchanged"
  );
  const batch = {
    name: "IfBatch",
    type: "IfCondition",
    dependsOn: depends("ChooseUpper"),
    typeProperties: {
      expression: expression(
        "@not(equals(activity('ChooseUpper').output.firstRow.watermark, activity('ReadWatermark').output.firstRow.watermark))"
      ),
      ifTrueActivities: [
        {
          name: "RunBatch",
          type: "ExecutePipeline",
          policy: { secureInput: true },
          typeProperties: {
            pipeline: reference(worker, "PipelineReference"),
            waitOnCompletion: true,
            parameters: {
              lowerWatermark: expression(
                "@activity('ReadWatermark').output.firstRow.watermark"
              ),
              upperWatermark: expression(
                "@activity('ChooseUpper').output.firstRow.watermark"
              ),
              runId: expression("@pipeline().RunId")
            }
          }
        }
      ],
      ifFalseActivities: []
    }
  };
  add(
    "pipelines",
    worker,
    {
      concurrency: 1,
      parameters: {
        lowerWatermark: { type: "String" },
        upperWatermark: { type: "String" },
        runId: { type: "String" }
      },
      activities: [
        validateBatch,
        workerPk,
        pkGate,
        metrics,
        qualityGate,
        copy,
        copied
      ]
    },
    [src, sink, control]
  );
  add(
    "pipelines",
    name,
    { concurrency: 1, activities: [read, pk, pkGate, upper, batch] },
    [src, sink, control],
    [worker]
  );
  assets["sql/ingestron-watermark-control-v1.sql"] = {
    format: "text",
    value: watermarkControlSql
  };
  assets[`handover/${name}.json`] = {
    format: "json",
    value: {
      apiVersion: "ingestron.native-watermark-delivery/v1",
      dataset: key,
      planDigest: plan.digest,
      consistency: state.consistency,
      control: {
        linkedService: state.controlLinkedService,
        table: "dbo.IngestronWatermarkV1",
        journal: "dbo.IngestronDeliveryV1"
      },
      landing: {
        linkedService: target.linkedService,
        fileSystem: target.fileSystem,
        prefix: `${target.path}/${node.flow}/${node.table}`
      },
      publication: "Only committed journal entries are published; failed or competing landing folders are unpublished",
      checkpoint: "Atomic watermark and journal compare-and-swap commit; changed plans require a reviewed separate namespace or explicit migration",
      execution: "not-run"
    }
  };
}

// src/publication.mjs
var check3 = (ok, message) => {
  if (!ok) throw new Error(message);
};
var expression2 = (value) => ({ type: "Expression", value });
var publicationLibraries = [
  { pypi: { package: "azure-storage-blob==12.30.1" } },
  { pypi: { package: "azure-identity==1.25.3" } }
];
function validatePublication(n) {
  const value = n.with.publication;
  check3(
    value && typeof value === "object" && Object.keys(value).every(
      (k) => ["linkedService", "notebookPath", "protocol"].includes(k)
    ),
    "Declare publication linkedService, notebookPath and protocol"
  );
  check3(
    /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(value.linkedService),
    "Use an existing Databricks linked service"
  );
  check3(
    typeof value.notebookPath === "string" && /^\/Workspace\/[A-Za-z0-9_./-]+$/.test(value.notebookPath) && value.notebookPath.split("/").every((p) => p !== "." && p !== ".."),
    "Supply the reviewed deployed publication notebookPath"
  );
  check3(
    value.protocol === "ingestron.snapshot-publication/v1",
    "Unsupported publication protocol"
  );
  check3(
    typeof n.with.target.storageAccount === "string" && /^[a-z0-9]{3,24}$/.test(n.with.target.storageAccount),
    "Publication requires the actual landing storageAccount"
  );
  check3(
    typeof n.contract?.version === "string" && n.contract.version,
    "Publication requires a contract version"
  );
}
function publicationPipeline(plan, n, name) {
  validatePublication(n);
  const t = n.with.target;
  const identity = {
    dataset: `${plan.project}.${n.flow}.${n.table}`,
    sourceRoot: `abfss://${t.fileSystem}@${t.storageAccount}.dfs.core.windows.net/${t.path}/${n.flow}/${n.table}`,
    contractVersion: n.contract.version,
    protocol: n.with.publication.protocol,
    contractShape: JSON.stringify(n.columns)
  };
  const parameters = {
    deliveryId: { type: "String" },
    version: { type: "Int" },
    capturedAt: { type: "String" },
    expectedRowCount: { type: "Int" },
    runId: { type: "String" },
    initialiseIndex: { type: "Bool", defaultValue: false }
  };
  const baseParameters = {
    ...identity,
    ...Object.fromEntries(
      Object.keys(parameters).map((key) => [
        key,
        expression2(`@string(pipeline().parameters.${key})`)
      ])
    )
  };
  return {
    name: name + "_publish",
    properties: {
      description: "Retry this pipeline with the original receipt to recover publication without rerunning Copy",
      concurrency: 1,
      parameters,
      activities: [
        {
          name: "PublishVerifiedSnapshot",
          type: "DatabricksNotebook",
          linkedServiceName: {
            type: "LinkedServiceReference",
            referenceName: n.with.publication.linkedService
          },
          policy: {
            timeout: n.runtime.options?.timeout ?? "00.01:00:00",
            retry: 2,
            retryIntervalInSeconds: 30,
            secureInput: true,
            secureOutput: true
          },
          typeProperties: {
            notebookPath: n.with.publication.notebookPath,
            baseParameters,
            libraries: publicationLibraries
          }
        }
      ]
    },
    identity
  };
}

// src/app-sources.mjs
var hubspotTables = {
  calls: "CRM.Engagements.Calls",
  companies: "CRM.Objects.Companies",
  contacts: "CRM.Objects.Contacts",
  deals: "CRM.Objects.Deals",
  emails: "CRM.Engagements.Emails",
  leads: "CRM.Objects.Leads",
  line_items: "CRM.Objects.Line_Items",
  marketing_campaigns: "Marketing.Campaigns",
  marketing_emails: "Marketing.Emails.Marketing_Emails",
  meetings: "CRM.Engagements.Meetings",
  notes: "CRM.Engagements.Notes",
  orders: "CRM.Commerce.Orders",
  owners: "CRM.Owners",
  products: "CRM.Objects.Products",
  tasks: "CRM.Engagements.Tasks",
  tickets: "CRM.Objects.Tickets"
};
var appSources = {
  salesforce: {
    label: "Salesforce",
    dataset: "SalesforceV2Object",
    valid: (object2) => typeof object2 === "string" && /^[A-Za-z][A-Za-z0-9_]{0,79}$/.test(object2),
    hint: "a Salesforce object API name such as Account or Invoice__c",
    table: (s) => ({ objectApiName: s.object }),
    // SOQL selects only the reviewed contract fields; deleted records are excluded.
    source: (s, columns) => ({
      type: "SalesforceV2Source",
      query: `SELECT ${columns.map((c) => c.name).join(", ")} FROM ${s.object}`,
      includeDeletedObjects: false
    })
  },
  hubspot: {
    label: "HubSpot",
    dataset: "HubspotObject",
    valid: (object2) => Object.hasOwn(hubspotTables, object2),
    hint: `one of ${Object.keys(hubspotTables).join(", ")}`,
    table: (s) => ({ tableName: hubspotTables[s.object] }),
    // HubSpot 2.0 has no query; the reviewed column mapping selects fields.
    source: () => ({ type: "HubspotSource" })
  }
};

// src/index.mjs
var check4 = (ok, message, reason) => {
  if (!ok) {
    const error = new Error(message);
    if (reason) error.reason = reason;
    throw error;
  }
};
var ident2 = (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_]*$/.test(v);
var sqlTable = (v) => typeof v === "string" && v.length <= 128 && /^[A-Za-z_][A-Za-z0-9_]*(?: [A-Za-z0-9_]+)*$/.test(v);
var resource3 = (v) => typeof v === "string" && /^[A-Za-z_][A-Za-z0-9_-]{0,100}$/.test(v);
var path = (v) => typeof v === "string" && v.length <= 512 && v.split("/").every(
  (x) => /^[A-Za-z0-9_-][A-Za-z0-9_.-]*$/.test(x) && x !== "." && x !== ".."
);
var strict2 = (v, keys, label) => check4(
  v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).every((k) => keys.includes(k)),
  `Unsupported ${label} settings`
);
var standards = [
  {
    id: watermarkStandard,
    sources: ["azure-sql", "sql-server"],
    dataFlow: "forbidden",
    consistency: "ordered-committed-append",
    delivery: "bounded Parquet batches published by an atomic Azure SQL watermark and committed-delivery journal"
  },
  {
    id: metadataStandard,
    sources: ["azure-sql", "sql-server"],
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery: "reviewed metadata-driven snapshots with per-worker count receipts"
  },
  {
    id: "snapshot-to-databricks@v1",
    sources: sqlKinds,
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery: "verified Parquet and atomically updated delivery index via a native Databricks notebook"
  },
  {
    id: "snapshot-land@v1",
    sources: sqlKinds,
    dataFlow: "forbidden",
    consistency: "frozen-extract",
    delivery: "isolated snapshot files; downstream publication required"
  },
  {
    id: "sharepoint-list-land@v1",
    sources: ["sharepoint-list"],
    dataFlow: "forbidden",
    consistency: "live list read; no point-in-time guarantee",
    delivery: "one Parquet snapshot of the list per run"
  },
  {
    id: "app-land@v1",
    sources: Object.keys(appSources),
    dataFlow: "forbidden",
    consistency: "live API read; no point-in-time guarantee",
    delivery: "one Parquet snapshot of the object per run"
  },
  {
    id: "immutable-file-copy@v1",
    sources: ["adls", "azure-blob", "s3", "gcs", "sftp"],
    dataFlow: "forbidden",
    consistency: "completed immutable file",
    delivery: "one preserved binary file per run"
  }
];
var checked = /* @__PURE__ */ new Set([
  "snapshot-land@v1",
  "snapshot-to-databricks@v1",
  watermarkStandard
]);
function expand({ flow, providerSource, columns = {} }) {
  check4(flow.kind === "ingestion", "ADF standards require ingestion flows");
  strict2(
    flow.ingestion,
    [
      "standard",
      "target",
      "allowEmpty",
      "publication",
      "handover",
      "group",
      "parallelism",
      "watermark"
    ],
    "ingestion"
  );
  const standard = standards.find((s) => s.id === flow.ingestion.standard);
  check4(standard, "Unsupported ADF standard; Data Flow fallback is forbidden");
  check4(
    !flow.steps && !Object.keys(flow.defaults.with ?? {}).length,
    "ADF standards own steps"
  );
  const steps = Object.entries(flow.tables ?? {}).map(([table, value]) => {
    check4(
      !Object.keys(value.steps ?? {}).length,
      "ADF table step overrides are not supported"
    );
    if (standard.id === watermarkStandard) {
      if (value.ingestion)
        strict2(value.ingestion, ["watermark"], "table ingestion");
      if (value.ingestion?.watermark)
        strict2(
          value.ingestion.watermark,
          ["column", "initial", "batchSize"],
          "table watermark"
        );
    } else
      check4(
        !value.ingestion,
        "ADF table ingestion overrides require the append watermark standard"
      );
    const settings = standard.id === watermarkStandard ? {
      ...flow.ingestion,
      watermark: {
        ...flow.ingestion.watermark,
        ...value.ingestion?.watermark
      }
    } : flow.ingestion;
    const quality = checked.has(standard.id) && value.contract ? qualityRules(value.contract, columns[table] ?? []) : [];
    return {
      id: `copy_${table}`,
      uses: "copy@v1",
      select: [table],
      with: quality.length ? { ...settings, quality } : settings
    };
  });
  return {
    steps,
    recovery: {
      standard: standard.id,
      provider: providerSource,
      dataFlow: "forbidden",
      actualCompleteness: "unverified",
      replaySource: "source-owner-retention",
      detail: standard.id === watermarkStandard ? "Copy only a bounded ordered immutable key range. Failed or competing landings are unpublished; the watermark and delivery journal commit atomically. Plan changes require a reviewed explicit state namespace or migration." : standard.id === "snapshot-to-databricks@v1" ? "Copy, count gate, then versioned native Databricks publication. Recover publication with the original run receipt; never recopy an already committed delivery." : "Each run creates an isolated landing directory. Failed runs are unpublished. No automatic deduplication, watermark or cumulative delivery-index publication.",
      assumptions: [
        standard.consistency,
        "Existing linked services and runtime connectivity are separately accepted."
      ]
    }
  };
}
function validate(plan) {
  adfScheduleFlows(plan);
  check4(plan.nodes.length > 0, "ADF export requires nodes");
  const names = /* @__PURE__ */ new Set();
  for (const n of plan.nodes) {
    check4(
      n.platform === "adf" && n.uses.split("@")[0] === "copy",
      "ADF exports accept only Copy standards"
    );
    check4(
      n.needs.length === 0,
      "Cross-table dependencies require a future ADF orchestration standard"
    );
    check4(
      !Object.keys(plan.flows.find((f) => f.id === n.flow)?.requires ?? {}).length,
      "Cross-provider handover is an external delivery boundary"
    );
    const name = `${plan.project}_${n.flow}_${n.table}`;
    check4(
      resource3(name) && !names.has(name),
      "Invalid or colliding ADF resource name"
    );
    names.add(name);
    const physicalColumns = /* @__PURE__ */ new Set(), outputColumns = /* @__PURE__ */ new Set();
    for (const column of n.columns ?? []) {
      const physical = column.name, output = column.target ?? physical;
      check4(
        ident2(physical) && ident2(output) && !physicalColumns.has(physical.toLowerCase()) && !outputColumns.has(output.toLowerCase()),
        "Invalid or case-ambiguous source/output column mapping"
      );
      physicalColumns.add(physical.toLowerCase());
      outputColumns.add(output.toLowerCase());
    }
    const binding = plan.bindings[n.binding];
    strict2(binding, ["kind", "factoryName"], "ADF binding");
    check4(
      binding.kind === "adf" && resource3(binding.factoryName),
      "Reference an existing ADF factoryName"
    );
    strict2(n.runtime.options ?? {}, ["timeout", "scheduleInputs"], "provider");
    const s = n.source, w = n.with, t = w.target;
    check4(s, "Source is required");
    strict2(
      w,
      [
        "standard",
        "target",
        "allowEmpty",
        "publication",
        "handover",
        "group",
        "parallelism",
        "quality",
        "watermark"
      ],
      "standard"
    );
    check4(
      w.quality === void 0 || checked.has(w.standard),
      "Contract quality checks apply to SQL snapshot standards only"
    );
    strict2(
      t,
      ["linkedService", "fileSystem", "path", "storageAccount"],
      "target"
    );
    check4(
      resource3(t.linkedService) && /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(t.fileSystem) && path(t.path),
      "Target requires existing ADLS linkedService, fileSystem and safe path"
    );
    check4(
      w.allowEmpty === void 0 || typeof w.allowEmpty === "boolean",
      "allowEmpty must be boolean"
    );
    if (w.standard === metadataStandard) {
      check4(ident2(w.group), "Metadata snapshots require a safe named group");
      check4(
        w.parallelism === void 0 || Number.isInteger(w.parallelism) && w.parallelism >= 1 && w.parallelism <= 16,
        "Metadata parallelism must be an integer from 1 to 16"
      );
      check4(
        w.handover === void 0,
        "Metadata snapshots do not yet expose a handover protocol"
      );
      check4(
        Object.values(metadataNames(plan.project, w.group)).every(resource3),
        "Metadata resource names exceed the supported length"
      );
    } else
      check4(
        w.group === void 0 && w.parallelism === void 0,
        "group and parallelism require metadata-snapshot-land@v1"
      );
    if (w.standard === "snapshot-to-databricks@v1") validatePublication(n);
    else
      check4(
        w.publication === void 0 && t.storageAccount === void 0,
        "Publication settings require snapshot-to-databricks@v1"
      );
    if (w.standard === watermarkStandard) {
      validateWatermark(plan, n);
    } else if (w.standard === "app-land@v1") {
      strict2(s, ["kind", "linkedService", "object"], "application source");
      const app = appSources[s.kind];
      check4(
        app && resource3(s.linkedService),
        `Application copies read ${Object.keys(appSources).join(", ")} through an existing linked service`
      );
      check4(app.valid(s.object), `${app.label} object must be ${app.hint}`);
      check4(
        n.columns.length > 0 && n.columns.every((c) => ident2(c.name)),
        "Explicit reviewed contract columns are required"
      );
      check4(
        w.allowEmpty === void 0,
        "allowEmpty applies to SQL snapshots only"
      );
    } else if (w.standard === "sharepoint-list-land@v1") {
      strict2(
        s,
        ["kind", "linkedService", "listName", "path", "entity"],
        "SharePoint list source"
      );
      check4(
        (s.entity ?? "list") === "list",
        "ADF reads SharePoint lists natively; SharePoint files need another route"
      );
      check4(
        s.kind === "sharepoint-list" && resource3(s.linkedService),
        "SharePoint lists need a SharePoint Online List linked service"
      );
      const listName = sharePointList(s);
      check4(
        typeof listName === "string" && listName.length > 0 && listName.length <= 255 && !listName.includes("'"),
        "Name the list with listName or path Lists/<name>; it cannot contain an apostrophe"
      );
      check4(
        n.columns.length > 0 && n.columns.every((c) => ident2(c.name)),
        "Explicit reviewed contract columns are required"
      );
      check4(
        w.allowEmpty === void 0,
        "allowEmpty applies to SQL snapshots only"
      );
    } else if ([
      "snapshot-land@v1",
      "snapshot-to-databricks@v1",
      metadataStandard
    ].includes(w.standard)) {
      strict2(
        s,
        ["kind", "linkedService", "schema", "table", "consistency"],
        "SQL source"
      );
      check4(
        w.standard === metadataStandard ? ["azure-sql", "sql-server"].includes(s.kind) : sqlKinds.includes(s.kind),
        w.standard === metadataStandard ? "Metadata snapshots support Azure SQL and SQL Server only" : `Snapshots support ${sqlKinds.join(", ")}`
      );
      check4(
        !w.quality?.some((q) => q.pattern !== void 0) || sqlSources[s.kind].dialect !== "tsql",
        "Pattern quality rules need a source with regular expressions; SQL Server has none that are portable. Use arguments.validValues or another source"
      );
      check4(
        s.consistency === "frozen-extract",
        "Snapshot source must remain immutable throughout extraction and retries; mutable live-table reads are not complete snapshots",
        "SOURCE_CONSISTENCY"
      );
      check4(
        resource3(s.linkedService) && ident2(s.schema) && sqlTable(s.table),
        "SQL source identifiers are required"
      );
      check4(
        n.columns.length > 0 && n.columns.every((c) => ident2(c.name)),
        "Explicit reviewed contract columns are required"
      );
      check4(
        !n.columns.some((c) => c.type === "BINARY"),
        "BINARY SQL columns require a separately tested mapping"
      );
    } else {
      check4(
        w.standard === "immutable-file-copy@v1",
        "Unsupported standard; Data Flow is forbidden"
      );
      strict2(
        s,
        [
          "kind",
          "linkedService",
          "fileSystem",
          "bucket",
          "container",
          "folder",
          "fileName",
          "path",
          "completion",
          "format"
        ],
        "file source"
      );
      check4(
        s.path === void 0 || s.folder === void 0 && s.fileName === void 0,
        "Name the file with path, or with folder and fileName, not both"
      );
      check4(
        ["adls", "azure-blob", "s3", "gcs", "sftp"].includes(s.kind) && resource3(s.linkedService),
        "Files support ADLS, S3, Google Cloud Storage and SFTP only"
      );
      check4(
        s.format === void 0 || ["csv", "tsv", "json", "jsonl", "parquet", "xml", "xlsx"].includes(
          s.format
        ),
        "Unsupported source file format"
      );
      check4(
        s.kind === "azure-blob" ? /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(s.container) : s.container === void 0,
        "Azure Blob needs a container"
      );
      const { folder, fileName } = fileLocation(s);
      check4(
        s.completion === "immutable" && (folder === void 0 || path(folder)) && path(fileName) && !fileName.includes("/") && (s.path === void 0 || /\.[A-Za-z0-9]+$/.test(fileName)),
        "Specify one completed immutable file (a path ends with the file name); folders, wildcards and mutable files are unsupported on ADF"
      );
      check4(
        s.kind === "adls" ? /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(s.fileSystem) : s.fileSystem === void 0,
        "fileSystem applies to ADLS only"
      );
      check4(
        ["s3", "gcs"].includes(s.kind) ? /^[a-z0-9][a-z0-9._-]{1,61}[a-z0-9]$/.test(s.bucket) : s.bucket === void 0,
        "bucket applies to S3 and Google Cloud Storage and must be a valid bucket name"
      );
      check4(w.allowEmpty === void 0, "allowEmpty applies to snapshots only");
    }
  }
  if (plan.nodes.some((n) => n.with.standard === metadataStandard)) {
    check4(
      plan.nodes.every((n) => n.with.standard === metadataStandard),
      "Metadata snapshots require a separate export from legacy standards"
    );
    metadataGroups(plan);
  }
  check4(
    new Set(plan.nodes.map((n) => plan.bindings[n.binding].factoryName)).size === 1,
    "One existing factory per export"
  );
}
var expression3 = (value) => ({ type: "Expression", value });
var fileLocation = (s) => {
  if (s.path === void 0) return { folder: s.folder, fileName: s.fileName };
  const cut = String(s.path).lastIndexOf("/");
  return cut < 0 ? { folder: void 0, fileName: s.path } : { folder: s.path.slice(0, cut), fileName: s.path.slice(cut + 1) };
};
var sharePointList = (s) => s.listName ?? (typeof s.path === "string" && s.path.startsWith("Lists/") ? decodeURIComponent(s.path.slice("Lists/".length)) : void 0);
function render(plan) {
  validate(plan);
  const assets = {}, resources = [];
  const add = (kind, name, properties, dependencies = [], pipelineDependencies = []) => {
    assets[`${kind}/${name}.json`] = {
      format: "json",
      value: { name, properties }
    };
    resources.push({
      type: `Microsoft.DataFactory/factories/${kind}`,
      apiVersion: "2018-06-01",
      name: `[concat(parameters('factoryName'), '/${name}')]`,
      properties,
      dependsOn: [
        ...dependencies.map(
          (d) => `[resourceId('Microsoft.DataFactory/factories/datasets', parameters('factoryName'), '${d}')]`
        ),
        ...pipelineDependencies.map(
          (d) => `[resourceId('Microsoft.DataFactory/factories/pipelines', parameters('factoryName'), '${d}')]`
        )
      ]
    });
  };
  if (plan.nodes[0].with.standard === metadataStandard)
    renderMetadata(plan, add, assets);
  else
    for (const n of plan.nodes) {
      if (n.with.standard === watermarkStandard) {
        renderWatermark(plan, n, add, assets);
        continue;
      }
      const s = n.source, w = n.with, t = w.target, snapshot = [
        "snapshot-land@v1",
        "snapshot-to-databricks@v1",
        metadataStandard
      ].includes(w.standard), list = w.standard === "sharepoint-list-land@v1", app = w.standard === "app-land@v1" ? appSources[s.kind] : void 0, tabular = snapshot || list || app !== void 0;
      const name = `${plan.project}_${n.flow}_${n.table}`, src = `${name}_source`, sink = `${name}_landing`;
      const { folder, fileName } = fileLocation(s);
      const sourceLocation = s.kind === "sftp" ? {
        type: "SftpLocation",
        ...folder ? { folderPath: folder } : {},
        fileName
      } : s.kind === "s3" || s.kind === "gcs" ? {
        type: s.kind === "s3" ? "AmazonS3Location" : "GoogleCloudStorageLocation",
        bucketName: s.bucket,
        ...folder ? { folderPath: folder } : {},
        fileName
      } : {
        type: s.kind === "azure-blob" ? "AzureBlobStorageLocation" : "AzureBlobFSLocation",
        ...s.kind === "azure-blob" ? { container: s.container } : { fileSystem: s.fileSystem },
        ...folder ? { folderPath: folder } : {},
        fileName
      };
      const sql = snapshot ? sqlSources[s.kind] : void 0;
      add("datasets", src, {
        type: snapshot ? sql.dataset : list ? "SharePointOnlineListResource" : app ? app.dataset : "Binary",
        linkedServiceName: {
          type: "LinkedServiceReference",
          referenceName: s.linkedService
        },
        typeProperties: snapshot ? sql.table(s) : list ? { listName: sharePointList(s) } : app ? app.table(s) : { location: sourceLocation }
      });
      add("datasets", sink, {
        type: tabular ? "Parquet" : "Binary",
        linkedServiceName: {
          type: "LinkedServiceReference",
          referenceName: t.linkedService
        },
        parameters: { runId: { type: "String" } },
        typeProperties: {
          location: {
            type: "AzureBlobFSLocation",
            fileSystem: t.fileSystem,
            folderPath: expression3(
              `@concat('${t.path}/${n.flow}/${n.table}/', dataset().runId)`
            ),
            ...!tabular ? { fileName: fileLocation(s).fileName } : {}
          },
          ...tabular ? { compressionCodec: "snappy" } : {}
        }
      });
      const policy = {
        timeout: n.runtime.options?.timeout ?? "00.01:00:00",
        retry: 0,
        secureInput: true,
        secureOutput: true
      };
      const copy = {
        name: "Copy",
        type: "Copy",
        policy,
        typeProperties: {
          source: snapshot ? {
            type: sql.source,
            [sql.query]: selectQuery(s.kind, n.columns, s.schema, s.table),
            ...sql.options
          } : list ? {
            type: "SharePointOnlineListSource",
            query: `$select=${n.columns.map((c) => c.name).join(",")}`
          } : app ? app.source(s, n.columns) : {
            type: "BinarySource",
            storeSettings: {
              type: s.kind === "sftp" ? "SftpReadSettings" : s.kind === "s3" ? "AmazonS3ReadSettings" : s.kind === "gcs" ? "GoogleCloudStorageReadSettings" : s.kind === "azure-blob" ? "AzureBlobStorageReadSettings" : "AzureBlobFSReadSettings",
              recursive: false
            }
          },
          sink: tabular ? {
            type: "ParquetSink",
            storeSettings: { type: "AzureBlobFSWriteSettings" },
            formatSettings: { type: "ParquetWriteSettings" }
          } : {
            type: "BinarySink",
            storeSettings: { type: "AzureBlobFSWriteSettings" }
          },
          enableStaging: false,
          validateDataConsistency: true,
          ...tabular ? {
            enableSkipIncompatibleRow: false,
            translator: {
              type: "TabularTranslator",
              mappings: n.columns.map((c) => ({
                source: { name: c.name },
                sink: { name: c.target ?? c.name }
              })),
              typeConversion: false
            }
          } : {}
        },
        inputs: [{ type: "DatasetReference", referenceName: src }],
        outputs: [
          {
            type: "DatasetReference",
            referenceName: sink,
            parameters: { runId: expression3("@pipeline().RunId") }
          }
        ]
      };
      const activities = [copy];
      if (w.quality?.length) {
        activities.unshift({
          name: "CheckQuality",
          type: "Lookup",
          policy,
          typeProperties: {
            source: {
              type: sql.source,
              [sql.query]: qualityQuery(
                w.quality,
                n.columns,
                s.schema,
                s.table,
                sql.dialect
              ),
              ...sql.options
            },
            dataset: { type: "DatasetReference", referenceName: src },
            firstRowOnly: true
          }
        });
        const passes = passingExpression(w.quality);
        if (passes)
          activities.splice(1, 0, {
            name: "VerifyQuality",
            type: "IfCondition",
            dependsOn: [
              { activity: "CheckQuality", dependencyConditions: ["Succeeded"] }
            ],
            typeProperties: {
              expression: expression3(passes),
              ifTrueActivities: [],
              ifFalseActivities: [
                {
                  name: "RejectContractQuality",
                  type: "Fail",
                  typeProperties: {
                    message: `Contract quality rules failed; nothing was copied. Error rules: ${w.quality.filter((q) => q.outcome === "fail").map((q) => q.id).join(", ")}. Counts are in the CheckQuality output.`,
                    errorCode: "INGESTRON_QUALITY_FAILED"
                  }
                }
              ]
            }
          });
        copy.dependsOn = [
          {
            activity: passes ? "VerifyQuality" : "CheckQuality",
            dependencyConditions: ["Succeeded"]
          }
        ];
      }
      if (snapshot)
        activities.push({
          name: "VerifyCount",
          type: "IfCondition",
          dependsOn: [
            { activity: "Copy", dependencyConditions: ["Succeeded"] }
          ],
          typeProperties: {
            expression: expression3(
              `@and(equals(activity('Copy').output.rowsCopied, pipeline().parameters.expectedRowCount), greaterOrEquals(pipeline().parameters.expectedRowCount, ${w.allowEmpty ? 0 : 1}))`
            ),
            ifTrueActivities: [],
            ifFalseActivities: [
              {
                name: "RejectIncompleteSnapshot",
                type: "Fail",
                typeProperties: {
                  message: "Snapshot count or empty-delivery policy failed. Do not publish this run.",
                  errorCode: "INGESTRON_SNAPSHOT_INCOMPLETE"
                }
              }
            ]
          }
        });
      let parameters = snapshot ? { expectedRowCount: { type: "Int" } } : {};
      const pipelineDependencies = [];
      if (w.standard === "snapshot-to-databricks@v1") {
        const publication = publicationPipeline(plan, n, name);
        add("pipelines", publication.name, publication.properties);
        pipelineDependencies.push(publication.name);
        parameters = { ...publication.properties.parameters };
        delete parameters.runId;
        activities.push({
          name: "Publish",
          type: "ExecutePipeline",
          dependsOn: [
            { activity: "VerifyCount", dependencyConditions: ["Succeeded"] }
          ],
          typeProperties: {
            pipeline: {
              type: "PipelineReference",
              referenceName: publication.name
            },
            waitOnCompletion: true,
            parameters: {
              ...Object.fromEntries(
                Object.keys(parameters).map((key) => [
                  key,
                  expression3(`@pipeline().parameters.${key}`)
                ])
              ),
              runId: expression3("@pipeline().RunId")
            }
          }
        });
        assets[`handover/${name}.json`] = {
          format: "json",
          value: {
            apiVersion: publication.identity.protocol,
            ...publication.identity,
            deliveryIndex: publication.identity.sourceRoot + "/_ingestron/deliveries.json",
            publicationNotebook: w.publication.notebookPath,
            recoveryPipeline: publication.name,
            dataFlow: "forbidden"
          }
        };
      }
      add(
        "pipelines",
        name,
        {
          description: `${w.standard}; no Data Flow; publish only after the entire pipeline succeeds`,
          concurrency: 1,
          parameters,
          activities
        },
        [src, sink],
        pipelineDependencies
      );
    }
  renderAdfSchedules(plan, add, assets);
  assets["adf-template.json"] = {
    format: "json",
    value: {
      $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentTemplate.json#",
      contentVersion: "1.0.0.0",
      parameters: { factoryName: { type: "string" } },
      resources
    }
  };
  assets["adf-parameters.json"] = {
    format: "json",
    value: {
      $schema: "https://schema.management.azure.com/schemas/2019-04-01/deploymentParameters.json#",
      contentVersion: "1.0.0.0",
      parameters: {
        factoryName: {
          value: plan.bindings[plan.nodes[0].binding].factoryName
        }
      }
    }
  };
  assets["README.md"] = {
    format: "text",
    value: "# ADF landing export\n\nOffline candidate. Use incremental ARM deployment into the existing factory after review.\nDo not use complete-mode deployment. Existing linked services, identities, runtime\nnetworking, monitoring and storage retention are customer-owned.\n\nEach run writes a new RunId folder. Copy retries are disabled: restart the pipeline\nto get a fresh folder after failure. Never consume a folder merely because it exists.\nSnapshot pipelines require an independently determined expectedRowCount for the\nfrozen source. Only successful whole pipelines are eligible for publication.\n\nsnapshot-to-databricks@v1 invokes a separately deployed Databricks 1.3.0+ publisher\nusing the declared v1 protocol. Supply source-sequenced versions starting at one,\ndeliveryId/capturedAt and expectedRowCount. Initialise the index explicitly once.\nUse the generated _publish pipeline with the original runId to retry publication\nwithout copying again. The publisher verifies contracts/keys/counts and uses\nconditional Blob writes. Other landing standards do not publish delivery indexes.\nThe ADF linked-service identity governs notebook execution; verify its privileges\nseparately from any Databricks job run_as identity. File copy preserves bytes without validating content.\nNo CDC, delete capture, automatic deduplication or source cleanup is generated.\n"
  };
  if (plan.nodes[0].with.standard === metadataStandard)
    assets["README.md"].value = "# Metadata-driven ADF snapshots\n\nDeploy adf-template.json incrementally into the existing factory after review.\nEach named compatible group has a coordinator, worker and two datasets.\nmetadata/*.json records the compiler-reviewed catalogue; the deployed worker embeds\nit and accepts only tableId and expectedRowCount. Call the coordinator with tables\nand expectedCounts, or retry one failed table with a fresh worker run. Fill every\nselected count from an independently frozen source; null example values must be\nreplaced. Tables default to the compiled group. Shared linked services and identities\nremain externally owned. Reviewed schedules are generated separately when configured. No control database or Data Flow is created.\n\nUse the worker runId from the ExecutePipeline activity output, not the coordinator\nrunId, to locate folder/<worker runId>/. Only Succeeded workers passing VerifyCount\nare eligible for consumption. A failed coordinator may contain successful workers;\nthere is no atomic group commit or cumulative publication index. Do not replay already\nconsumed tables without downstream duplicate handling. Failed folders are retained;\ncopy retries are zero and recovery uses fresh run folders. Source consistency,\nretention, keys/null checks, cross-table consistency and downstream publication remain\noperator responsibilities. See the provider docs/metadata-pipelines.md for limits.\n";
  return assets;
}
export {
  expand,
  render,
  standards,
  validate
};
