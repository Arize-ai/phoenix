import { createDataset } from "@arizeai/phoenix-client/datasets";
import {
  asEvaluator,
  runExperiment,
} from "@arizeai/phoenix-client/experiments";
import { ExperimentTask } from "@arizeai/phoenix-client/types/experiments";

import { createDocumentRelevancyEvaluator } from "../src/llm";

import { openai } from "@ai-sdk/openai";

const relevanceEvaluator = createDocumentRelevancyEvaluator({
  model: openai("gpt-4o-mini"),
});

const examples = [
  {
    input: "how are glacier caves formed?",
    documentText:
      "A partly submerged glacier cave on Perito Moreno Glacier . The ice facade is approximately 60 m high Ice formations in the Titlis glacier cave A glacier cave is a cave formed within the ice of a glacier . Glacier caves are often called ice caves , but this term is properly used to describe bedrock caves that contain year-round ice.",
    relevant: true,
  },
  {
    input: "how an outdoor wood boiler works",
    documentText:
      "The outdoor wood boiler is a variant of the classic wood stove adapted for set-up outdoors while still transferring the heat to interior buildings.",
    relevant: false,
  },
  {
    input: "what happens to the light independent reactions of photosynthesis?",
    documentText:
      "The simplified internal structure of a chloroplast Overview of the Calvin cycle and carbon fixation The light-independent reactions of photosynthesis are chemical reactions that convert carbon dioxide and other compounds into glucose . These reactions occur in the stroma , the fluid-filled area of a chloroplast outside of the thylakoid membranes. These reactions take the light-dependent reactions and perform further chemical processes on them. There are three phases to the light-independent reactions, collectively called the Calvin cycle : carbon fixation, reduction reactions, and ribulose 1,5-bisphosphate (RuBP) regeneration. Despite its name, this process occurs only when light is available. Plants do not carry out the Calvin cycle by night. They, instead, release sucrose into the phloem from their starch reserves. This process happens when light is available independent of the kind of photosynthesis ( C3 carbon fixation , C4 carbon fixation , and Crassulacean Acid Metabolism ); CAM plants store malic acid in their vacuoles every night and release it by day in order to make this process work.",
    relevant: true,
  },
  {
    input: "where in the bible that palestine have no land in jerusalem",
    documentText:
      'The Philistine cities of Gaza, Ashdod, Ashkelon, Ekron, and Gath The Philistines (, , , or ; , Plištim), Pleshet or Peleset, were a people who as part of the Sea Peoples appeared in the southern coastal area of Canaan at the beginning of the Iron Age (circa 1175 BC), most probably from the Aegean region. According to the Bible , they ruled the five city-states (the "Philistine Pentapolis") of Gaza , Ashkelon , Ashdod , Ekron and Gath , from Wadi Gaza in the south to the Yarqon River in the north, but with no fixed border to the east. The Bible paints them as the Kingdom of Israel \'s most dangerous enemy. Originating somewhere in the Aegean , their population was around 25,000 in the 12th century BC, rising to a peak of 30,000 in the 11th century BC, of which the Aegean element was not more than half the total, and perhaps much less. Nothing is known for certain about the original language or languages of the Philistines, however they were not part of the Semitic Canaanite population. There is some limited evidence in favour of the assumption that the Philistines were Indo-European-speakers either from Greece and/or Luwian speakers from the coast of Asia Minor . Philistine-related words found in the Bible are not Semitic, and can in some cases, with reservations, be traced back to Proto-Indo-European roots. By the beginning of the 1st Millennium BCE they had adopted the general Canaanite language of the region.',
    relevant: false,
  },
  {
    input: "what are the test scores on asvab",
    documentText:
      "The Armed Services Vocational Aptitude Battery (ASVAB) is a multiple choice test, administered by the United States Military Entrance Processing Command , used to determine qualification for enlistment in the United States armed forces . It is often offered to American high school students when they are in the 10th, 11th and 12th grade, though anyone eligible for enlistment may take it. Although the test is administered by the military, it is not (and never has been) a requirement that a test-taker with a qualifying score enlist in the armed forces.",
    relevant: false,
  },
  {
    input: "what are corporation balance",
    documentText:
      "In financial accounting , a balance sheet or statement of financial position is a summary of the financial balances of a sole proprietorship , a business partnership , a corporation or other business organization, such as an LLC or an LLP . Assets , liabilities and ownership equity are listed as of a specific date, such as the end of its financial year . A balance sheet is often described as a \"snapshot of a company's financial condition\". Of the four basic financial statements , the balance sheet is the only statement which applies to a single point in time of a business' calendar year. A standard company balance sheet has three parts: assets, liabilities and ownership equity. The main categories of assets are usually listed first, and typically in order of liquidity . Assets are followed by the liabilities. The difference between the assets and the liabilities is known as equity or the net assets or the net worth or capital of the company and according to the accounting equation , net worth must equal assets minus liabilities. Another way to look at the same equation is that assets equals liabilities plus owner's equity. Looking at the equation in this way shows how assets were financed: either by borrowing money (liability) or by using the owner's money (owner's equity). Balance sheets are usually presented with assets in one section and liabilities and net worth in the other section with the two sections \"balancing.\" A business operating entirely in cash can measure its profits by withdrawing the entire bank balance at the end of the period, plus any cash in hand. However, many businesses are not paid immediately; they build up inventories of goods and they acquire buildings and equipment. In other words: businesses have assets and so they cannot, even if they want to, immediately turn these into cash at the end of each period. Often, these businesses owe money to suppliers and to tax authorities, and the proprietors do not withdraw all their original capital and profits at the end of each period. In other words businesses also have liabilities .",
    relevant: true,
  },
  {
    input: "what is .17 hmr caliber",
    documentText:
      ".17 Hornady Magnum Rimfire, commonly known as the .17 HMR, is a rimfire rifle cartridge developed by the ammunition company Hornady in 2002. It descended from the .22 Magnum by necking down the .22 Magnum case to take a .17 caliber (4.5 mm) bullet, and it is more costly to shoot than traditional .22 caliber rimfire cartridges. Commonly loaded with a 17 grain (1.1 g) bullet, it can deliver muzzle velocities in excess of 2550 ft/s (775 m/s).",
    relevant: true,
  },
  {
    input: "what professional baseball pitchers were on the Schaumburg Flyers",
    documentText:
      'The Schaumburg Flyers were a professional baseball team based in Schaumburg, Illinois , in the United States . The Flyers were to be a charter member of the North American League , which is not affiliated with Major League Baseball , however, the team folded in March 2011, before they began play in the NAL. From the 1999 season to the 2010 season, the Flyers played their home games at Alexian Field , near the Elgin O\'Hare Expressway . The team formerly played in Thunder Bay , Ontario , where they were known as the Thunder Bay Whiskey Jacks. The team was originally a member of the Northern League from 1993 to 2010. On July 27, 2009, the Flyers played host to Battle of the Sexes II, which pitted the Flyers against the National Pro Fastpitch Softball Champions, the Chicago Bandits. Played by official softball rules, the game was seen by an overflow record crowd of 8,918, and was won by the Bandits 4-2. In 1999, the Flyers hired their first manager, Ron Kittle . Kittle is best known for his playing days with the Chicago White Sox , and former Chicago Cubs and White Sox player Greg Hibbard was the pitching coach. During the early years of the franchise, Kittle did a series of TV commercials to promote the team, using the gimmick "Ma Kittle." where he played both himself and his "Ma." The ads were successful at sparking some initial interest in the team as the Flyers hoped to steal away fans from the nearby Kane County Cougars . The ad mimicked the highly successful Converse ads where Larry Johnson starred as both himself and "Gramama." At the end of the 2001 season, however, Kittle resigned from his managerial position, and Jim Boynewicz was hired to replace him. In 2004, the Flyers made it to the Northern League Championship Series against the St. Paul Saints . Despite leading the five-game series 2-1, Schaumburg eventually lost the series. In Game 5, Flyers relief pitcher Lyle Prempas allowed a game winning grand slam by St. Paul infielder Marc Mirizzi in the ninth inning. The Flyers appeared in the Northern League Playoffs four times (1999, 2003, 2004, 2006) but never won the championship. Some famous players who played for the Flyers were former Oakland A\'s outfielder Ozzie Canseco and former Chicago Cubs outfielder Dwight Smith .',
    relevant: false,
  },
  {
    input: "what movies has rachel weisz turned down",
    documentText:
      "Rachel Hannah Weisz ( / vice /; born 7 March 1970) is an English film and theatre actress and former fashion model. Weisz began her acting career at Trinity Hall, Cambridge in the early 1990s, then started working in television, appearing in Inspector Morse , the British mini-series Scarlet and Black , and the television film Advocates II. She made her film début in the film Death Machine (1994), but her breakthrough role came in the film Chain Reaction (1996), leading to a high-profile role as Evelyn Carnahan-O'Connell in the films The Mummy (1999) and The Mummy Returns (2001). Other notable films featuring Weisz are Enemy at the Gates , About a Boy , Constantine , The Fountain and The Constant Gardener , for which she received an Academy Award , a Golden Globe and a Screen Actors' Guild award for her supporting role as Tessa Quayle. She has been labelled an \"English rose\" since her minor role in Stealing Beauty (1996). Weisz also works in theatre. Her stage breakthrough was the 1994 revival of Noël Coward 's play Design for Living , which earned her the London Critics Circle Award for the most promising newcomer. Weisz's performances also include the 1999 Donmar Warehouse production of Tennessee Williams ' Suddenly, Last Summer , and their 2009 revival of A Streetcar Named Desire . Her portrayal of Blanche DuBois in the latter play earned her the Critics' Circle Theatre Award for Best Actress. She has recently played Evanora in Oz the Great and Powerful .",
    relevant: false,
  },
  {
    input: "what made the civil war different from others",
    documentText:
      'The American Civil War (ACW), also known as the War between the States or simply the Civil War (see naming ), was a civil war fought from 1861 to 1865 between the United States (the "Union" or the "North") and several Southern slave states that declared their secession and formed the Confederate States of America (the "Confederacy" or the "South"). The war had its origin in the issue of slavery , especially the extension of slavery into the western territories. Foreign powers did not intervene. After four years of bloody combat that left over 600,000 soldiers dead and destroyed much of the South\'s infrastructure, the Confederacy collapsed, slavery was abolished, and the difficult Reconstruction process of restoring national unity and guaranteeing rights to the freed slaves began. In the 1860 presidential election , Republicans, led by Abraham Lincoln , opposed expanding slavery into United States\' territories . Lincoln won, but before his inauguration on March 4, 1861, seven cotton-based slave states formed the Confederacy. Outgoing Democratic President James Buchanan and the incoming Republicans rejected secession as illegal. Lincoln...',
    relevant: true,
  },
  {
    input: "where to buy potato bread made without wheat",
    documentText:
      "Potato bread is a form of bread in which potato replaces a portion of the regular wheat flour . It is cooked in a variety of methods, including by baking it on a hot griddle or pan, or in an oven. It may be leavened or unleavened, and may have a variety of other ingredients baked into it. The ratio of potato to wheat flour varies significantly from recipe to recipe, with some recipes having a majority of potato, and others having a majority of wheat flour. Some recipes call for mashed potatoes, with others calling for dehydrated potato flakes. It is available as a commercial product in many countries, with similar variations in ingredients, cooking method, and other variables.",
    relevant: true,
  },
  {
    input: "what states are on pacific daylight time",
    documentText:
      "The Pacific Time Zone observes standard time by subtracting eight hours from Coordinated Universal Time (). The clock time in this zone is based on the mean solar time of the 120th meridian west of the Greenwich Observatory . During daylight saving time , its time offset is . In the United States and Canada , this time zone is generically called Pacific Time (PT). Specifically, it is Pacific Standard Time (PST) when observing standard time (winter), and Pacific Daylight Time (PDT) when observing daylight saving time (summer). Most of Canada uses daylight saving time . In Mexico the UTC−8 time zone is known as the Northwest Zone, which is synchronized with the U.S. PDT daylight saving schedule. The largest city in the Pacific Time Zone is Los Angeles in California from USA ; the city's metropolitan area is the largest in the zone. The zone is one hour ahead of the Alaska Time Zone , one hour behind the Mountain Time Zone and three hours behind the Eastern Time Zone .",
    relevant: false,
  },
  {
    input:
      "How Do You Find the mean of the squares of the first 10 counting numbers",
    documentText:
      'In mathematics , a square number or perfect square is an integer that is the square of an integer; in other words, it is the product of some integer with itself. For example, 9 is a square number, since it can be written as . The usual notation for the formula for the square of a number is not the product , but the equivalent exponentiation , usually pronounced as " squared". The name square number comes from the name of the shape; see below . Square numbers are non-negative . Another way of saying that a (non-negative) number is a square number, is that its square roots are again integers. For example, = ±3, so 9 is a square number. A positive integer that has no perfect square divisors except 1 is called square-free . For a non-negative integer , the th square number is , with being the zeroth square. The concept of square can be extended to some other number systems. If rational numbers are included, then a square is the ratio of two square integers, and, conversely, the ratio of two square integers is a square (e.g., 4/9 = (2/3)2). Starting with 1, there are square numbers up to and including , where the expression represents the floor of the number .',
    relevant: false,
  },
  {
    input: "what year was the 8 track invented",
    documentText:
      'Stereo 8, commonly known as the eight-track cartridge, eight-track tape, or simply eight-track, is a magnetic tape sound recording technology. It was popular in the United States from the mid-1960s through to the early 1980s, but was relatively unknown in many European countries. It was, however, very popular in the United Kingdom during this period. Stereo 8 was created in 1964 by a consortium led by Bill Lear of Lear Jet Corporation, along with Ampex , Ford Motor Company , General Motors , Motorola , and RCA Victor Records (RCA). It was a further development of the similar Stereo-Pak four-track cartridge created by Earl "Madman" Muntz . A later quadraphonic version of the format was announced by RCA in April 1970 and first known as Quad-8, then later changed to just Q8.',
    relevant: true,
  },
  {
    input: "what leaves are in pharaoh ramses 2 mummy",
    documentText:
      "Ramesses II ( 1303 BC – July or August 1213 BC; Egyptian : , alternatively transcribed as Rameses and Ramses or ), referred to as Ramesses the Great, was the third Egyptian pharaoh (reigned 1279 BC – 1213 BC) of the Nineteenth dynasty . He is often regarded as the greatest, most celebrated, and most powerful pharaoh of the Egyptian Empire . His successors and later Egyptians called him the \"Great Ancestor.\" Ramesses II led several military expeditions into the Levant , re-asserting Egyptian control over Canaan . He also led expeditions to the south, into Nubia , commemorated in inscriptions at Beit el-Wali and Gerf Hussein . At age fourteen, Ramesses was appointed Prince Regent by his father Seti I . He is believed to have taken the throne in his late teens and is known to have ruled Egypt from 1279 BC to 1213 BC for 66 years and 2 months, according to both Manetho and Egypt's contemporary historical records. He was once said to have lived to be 99 years old, but it is more likely that he died in his 90th or 91st year. If he became Pharaoh in 1279 BC as most Egyptologists today believe, he would have assumed the throne on May 31, 1279 BC, based on his known accession date of III Shemu day 27. Ramesses II celebrated an unprecedented 14 sed festivals (the first held after thirty years of a pharaoh's reign, and then every three years) during his reign—more than any other pharaoh. On his death, he was buried in a tomb in the Valley of the Kings ; his body was later moved to a royal cache where it was discovered in 1881, and is now on display in the Cairo Museum . The early part of his reign was focused on building cities, temples and monuments. He established the city of Pi-Ramesses in the Nile Delta as his new capital and main base for his campaigns in Syria. This city was built on the remains of the city of Avaris , the capital of the Hyksos when they took over, and was the location of the main Temple of Set . He is also known as Ozymandias in the Greek sources, from a transliteration into Greek of a part of Ramesses's throne name , , \" Ra 's mighty truth , chosen of Ra\".",
    relevant: false,
  },
  {
    input: "who owns the texas rangers",
    documentText:
      "The Texas Rangers are a professional baseball team located in the Dallas-Fort Worth Metroplex , based in Arlington, Texas . The Rangers franchise is currently a member of the Western Division of Major League Baseball 's American League . Since , the Rangers have played in Rangers Ballpark in Arlington in Arlington, Texas . The team's name is borrowed from the famous law enforcement agency of the same name. The franchise was established in 1961 by the name of the Washington Senators, an expansion team awarded to Washington, D.C., after the city's first ballclub, the original Washington Senators, moved to Minnesota and became the Twins . After the season, the new Senators moved to Arlington, Texas , and debuted as the Rangers the following spring. The Texas Rangers Baseball Club has made six appearances in the MLB postseason, all following division championships, in 1996, 1998, 1999, 2010, 2011 and 2012. In 2010, the Rangers advanced past the Division Series for the first time, defeating the Tampa Bay Rays . Texas then brought home their first American League Pennant after beating the New York Yankees in six games. In the 2010 World Series , the franchise's first, the Rangers fell to the San Francisco Giants in five games. Their lone victory made them the first Texas team to win a World Series game, the Houston Astros having been swept in their 2005 World Series appearance. They repeated as American League champions the following year, then lost the 2011 World Series to the St. Louis Cardinals in seven games.",
    relevant: false,
  },
  {
    input: "who killed julius caesar",
    documentText:
      "Gaius Julius Caesar (, July 100 BC – 15 March 44 BC) was a Roman general , statesman , Consul and notable author of Latin prose. He played a critical role in the events that led to the demise of the Roman Republic and the rise of the Roman Empire . In 60 BC, Caesar, Crassus and Pompey formed a political alliance that was to dominate Roman politics for several years. Their attempts to amass power through populist tactics were opposed by the conservative elite within the Roman Senate , among them Cato the Younger with the frequent support of Cicero . Caesar's conquest of Gaul , completed by 51 BC, extended Rome's territory to the English Channel and the Rhine . Caesar became the first Roman general to cross both when he built a bridge across the Rhine and conducted the first invasion of Britain . These achievements granted him unmatched military power and threatened to eclipse the standing of Pompey, who had realigned himself with the Senate after the death of Crassus in 53 BC. With the Gallic Wars concluded, the Senate ordered Caesar to lay down his military command and return to Rome. Caesar refused, and marked his defiance in 49 BC by crossing the Rubicon with a legion , leaving his province and illegally entering Roman territory under arms. Civil war resulted, from which he emerged as the unrivaled leader of Rome. After assuming control of government, Caesar began a program of social and governmental reforms, including the creation of the Julian calendar . He centralised the bureaucracy of the Republic and was eventually proclaimed \"dictator in perpetuity\". But the underlying political conflicts had not been resolved, and on the Ides of March (15 March) 44 BC, Caesar was assassinated by a group of senators led by Marcus Junius Brutus . A new series of civil wars broke out, and the constitutional government of the Republic was never restored. Caesar's adopted heir Octavian, later known as Augustus , rose to sole power, and the era of the Roman Empire began. Much of Caesar's life is known from his own accounts of his military campaigns, and from other contemporary sources, mainly the letters and speeches of Cicero and the historical writings of Sallust . The later biographies of Caesar by Suetonius and Plutarch are also major sources. Caesar is deemed to be one of the greatest military commanders of history .",
    relevant: true,
  },
  {
    input: "what are the official languages of nigeria",
    documentText:
      "Linguistic map of Nigeria, Cameroon, and Benin. Sign in English, outside the University of Lagos There are hundreds of languages spoken in Nigeria. The major languages are Yoruba , Hausa , Igbo , Edo , Fulfulde , Kanuri , and Ibibio . The official language of Nigeria, English , the former colonial language, was chosen to facilitate the cultural and linguistic unity of the country. English, however, remains an exclusive preserve of the country's urban elite, and is not widely spoken in rural areas, which comprise three quarters of the countries population. Nigeria's linguistic diversity is a microcosm of Africa as a whole, encompassing three major African languages families : Afroasiatic , Nilo-Saharan , and Niger–Congo . Nigeria also has several as-yet unclassified languages, such as Cen Tuum , which may represent a relic of an even greater diversity prior to the spread of the current language families.",
    relevant: true,
  },
  {
    input: "What are the characteristics of wild carrot?",
    documentText:
      "Daucus carota ( common names include wild carrot, (UK) bird's nest, bishop's lace, and Queen Anne's lace (North America)) is a flowering plant in the family Apiaceae , native to temperate regions of Europe, southwest Asia and naturalised to North America and Australia. Domesticated carrots are cultivars of a subspecies, Daucus carota subsp. sativus.",
    relevant: false,
  },
  {
    input: "what part of the government is the federal court judge in?",
    documentText:
      'In the United States, the title of federal judge usually means a judge appointed by the President of the United States and confirmed by the United States Senate pursuant to the Appointments Clause in Article II of the United States Constitution . In addition to the Supreme Court of the United States , whose existence and some aspects of whose jurisdiction are beyond the constitutional power of Congress to alter, acts of Congress have established 13 courts of appeals (also called "circuit courts") with appellate jurisdiction over different regions of the United States, and 94 United States district courts . Every judge appointed to such a court may be categorized as a federal judge; such positions include the Chief Justice and Associate Justices of the Supreme Court, Circuit Judges of the courts of appeals, and district judges of the United States district courts . All of these judges described thus far are referred to sometimes as "Article III judges" because they exercise the judicial power vested in the judicial branch of the federal government by Article III of the U.S. Constitution. In addition, judges of the Court of International Trade exercise judicial power pursuant to Article III. Other judges serving in the federal courts, including magistrate judges and bankruptcy judges , are also sometimes referred to as "federal judges"; however, they are neither appointed by the President nor confirmed by the Senate, and their power derives from Article I instead. See Article I and Article III tribunals .',
    relevant: false,
  },
  {
    input: "who has nellie furtado collaborated with",
    documentText:
      'Nelly Kim Furtado (born December 2, 1978) is a Canadian singer, songwriter and actress. She has sold 20 million albums worldwide and more 20 million singles, bringing her total sales to over 40 million records around the world. Furtado first gained fame with her debut album, Whoa, Nelly! , which spawned two successful singles, " I\'m Like a Bird " and " Turn Off the Light ". " I\'m Like A Bird" won a 2001 Juno Award for Single of the Year and a 2002 Grammy Award for Best Female Pop Vocal Performance . In 2003, Furtado released Folklore , which produced three international singles— " Powerless (Say What You Want) ", " Try " and " Força ". Three years later she released Loose , a worldwide commercial success. The album spawned four number-one hits: " Promiscuous ", " Maneater ", " Say It Right " and " All Good Things (Come to an End) ". After a three-year break, she released her first full-length Spanish album, Mi Plan , and Furtado received a Latin Grammy for Best Female Pop Vocal Album. In 2012, Furtado\'s fourth English-language studio album, The Spirit Indestructible was released. Furtado\'s work has earned her numerous awards and accolades, including 2 Grammy Awards, 10 Juno Awards, 3 MuchMusic Video Awards and a star on Canada\'s Walk of Fame .',
    relevant: false,
  },
  {
    input: "who played guitar on the kiss album, creatures of the night",
    documentText:
      "Creatures of the Night is the tenth studio album by Kiss . It is the band's last album for Casablanca Records , the only label the group had ever recorded for at that point. The album was dedicated to the memory of Casablanca founder and early Kiss supporter Neil Bogart , who had died of cancer during the recording sessions. It is also the band's last album recorded with Ace Frehley credited as an official member (until 1998's Psycho Circus ), and its first album with Vinnie Vincent as the initially uncredited lead guitarist (Vincent would later be credited, but not featured pictorially on the cover, of 1985's reissue of the album ).",
    relevant: true,
  },
  {
    input: "Who discovered the sense of touch?",
    documentText:
      'Touch is a crucial means of receiving information. This photo shows tactile markings identifying stairs for visually impaired people. The somatosensory system is a diverse sensory system comprising the receptors and processing centres to produce the sensory modalities such as touch, temperature , proprioception (body position), and nociception (pain). The sensory receptors cover the skin and epithelia , skeletal muscles , bones and joints , internal organs , and the cardiovascular system . While touch is considered one of the five traditional senses , the impression of touch is formed from several modalities. In medicine, the colloquial term "touch" is usually replaced with "somatic senses" to better reflect the variety of mechanisms involved. Somatic senses are sometimes referred to as somesthetic senses, with the understanding that somesthesis includes touch, proprioception and (depending on usage) also haptic perception. The system reacts to diverse stimuli using different receptors: thermoreceptors , nociceptors , mechanoreceptors and chemoreceptors . Transmission of information from the receptors passes via sensory nerves through tracts in the spinal cord and into the brain. Processing primarily occurs in the primary somatosensory area in the parietal lobe of the cerebral cortex . The cortical homunculus was devised by Wilder Penfield . At its simplest, the system works when activity in a sensory neuron is triggered by a specific stimulus such as heat; this signal eventually passes to an area in the brain uniquely attributed to that area on the body—this allows the processed stimulus to be felt at the correct location. The point-to-point mapping of the body surfaces in the brain is called a homunculus and is essential in the creation of a body image . This brain-surface ("cortical") map is not immutable, however. Dramatic shifts can occur in response to stroke or injury.',
    relevant: false,
  },
  {
    input: "what is a magnolias kingdom?",
    documentText:
      "Magnolia is a large genus of about 210 flowering plant species in the subfamily Magnolioideae of the family Magnoliaceae . It is named after French botanist Pierre Magnol . Magnolia is an ancient genus. Appearing before bees did, the flowers evolved to encourage pollination by beetles . To avoid damage from pollinating beetles, the carpels of Magnolia flowers are extremely tough. Fossilised specimens of Magnolia acuminata have been found dating to 20 million years ago, and of plants identifiably belonging to the Magnoliaceae dating to 95 million years ago. Another aspect of Magnolias that is considered to represent an ancestral state is that the flower bud is enclosed in a bract rather than in sepals; the perianth parts are undifferentiated and called tepals rather than distinct sepals and petals . Magnolia shares the tepal characteristic with several other flowering plants near the base of the flowering plant lineage such as Amborella and Nymphaea (as well as with many more recently derived plants such as Lilium ). The natural range of Magnolia species is a disjunct distribution , with a main centre in east and southeast Asia and a secondary centre in eastern North America , Central America , the West Indies , and some species in South America .",
    relevant: false,
  },
  {
    input: "who wrote white christmas",
    documentText:
      'thumb "White Christmas" is an Irving Berlin song reminiscing about an old-fashioned Christmas setting . According to the Guinness Book of World Records , the version sung by Bing Crosby is the best-selling single of all time, with estimated sales in excess of 50 million copies worldwide. Accounts vary as to when and where Berlin wrote the song. One story is that he wrote it in 1940 , in warm La Quinta, California , while staying at the La Quinta Hotel, a frequent Hollywood retreat also favored by writer-producer Frank Capra , although the Arizona Biltmore also claims the song was written there. He often stayed up all night writing — he told his secretary, "Grab your pen and take down this song. I just wrote the best song I\'ve ever written — heck, I just wrote the best song that anybody\'s ever written!"',
    relevant: true,
  },
  {
    input: "what are the different types of cross country skiing",
    documentText:
      "Cross-country skiing (or XC skiing) is a form of ski touring in which participants propel themselves across snow-covered terrain using skis and poles . The activity is popular in many places with large snowfields, primarily Northern Europe , Canada , and Alaska . Cross-country skiing is part of the Nordic skiing sport family, which includes ski jumping , Nordic combined (cross-country skiing and ski jumping), Biathlon (skiing and rifle marksmanship ) and ski-orienteering (which includes map navigation along snow trails and tracks). Cross-country skiing is the modern style of skiing that most resembles prehistoric skiing , particularly when done in the backcountry . It is also related to Telemark skiing .",
    relevant: true,
  },
  {
    input: "what are use taxes?",
    documentText:
      'A use tax in United States is complementary to sales tax which means, if you buy a Taxable product/services without paying any Sales tax to vendor, you owe use tax. You must self assess use tax and pay it directly to the state where the products were consumed or services were rendered. Use tax typically is a tax on consumption but if you buy an item (without paying sales tax) and store it in your warehouse initially, use tax applies to that location where goods were stored. Later on when the final consumption takes place at some other location, you are required to pay the differential of tax rate to the jurisdiction of ultimate place of consumption. This really means that you don\'t have to pay both Sales Tax as well as Use Tax on one transaction. It is only one or the other that you are required to pay on purchase of taxable products/services. If vendor doesn\'t charge any Sales tax on its invoice then it is the obligation of the buyer to self assess Use tax and pay it to the appropriate Jurisdication. Use Tax is generally charged at the same tax rate of Sales Tax but in some states the tax rate is different. Use tax is also termed as "Consumption Tax" or "Con...',
    relevant: true,
  },
  {
    input: "who pulmonary hypertension",
    documentText:
      "In medicine , pulmonary hypertension (PH) is an increase of blood pressure in the pulmonary artery , pulmonary vein , or pulmonary capillaries, together known as the lung vasculature , leading to shortness of breath , dizziness , fainting , and other symptoms, all of which are exacerbated by exertion. Pulmonary hypertension can be a severe disease with a markedly decreased exercise tolerance and heart failure . It was first identified by Dr. Ernst von Romberg in 1891. According to the most recent classification, it can be one of five different types: arterial, venous, hypoxic, thromboembolic or miscellaneous.",
    relevant: true,
  },
  {
    input: "what are sanuks made of",
    documentText:
      'right right Sanuk, a division of Deckers Outdoor Corporation , is a footwear brand based in Southern California . Sanuk, the Thai word for fun, was founded by Southern California native Jeff Kelley when he started making sandals out of indoor-outdoor carpet . The first product created was green carpeted and entitled the "Fur Real" after one shop owner asked if the novelty sandal was "For Real." The Fur Real first became a runaway hit through boutique stores and not the intended surf shops . The novelty act was followed up by a sandal wrapped in wire mesh, a leopard print version, and styles made out of a poncho material in a variety of colors. Sanuk has grown to include style options for men, women and youth and is distributed across the United States and in over 50 countries throughout Europe , Asia , South America and Australia . Sanuk centers itself around a positive lifestyle advocating the slogan, "Smile,Pass it on!".',
    relevant: false,
  },
  {
    input: "what ended the era of good feelings",
    documentText:
      "The Era of Good Feelings marked a period in the political history of the United States that reflected a sense of national purpose and a desire for unity among Americans in the aftermath of the Napoleonic Wars . The era saw the collapse of the Federalist Party and an end to the bitter partisan disputes between it and the dominant Democratic-Republican party during the First Party System . President James Monroe endeavored to downplay partisan affiliation in making his nominations, with the ultimate goal of national unity and eliminating parties altogether from national politics. The period is so closely associated with Monroe's presidency (1817–1825) and his administrative goals that his name and the era are virtually synonymous. The Era of Good Feelings marked a transition in American politics with the end of the Federalist Party as America began to develop after the War of 1812. While America was experiencing growth and prosperity after the war with Britain, this era also marks the first instance of economic troubles in the growing United States. Mirroring the American System proposed by Henry Clay, protective tariffs and the chartering of th...",
    relevant: true,
  },
];

type TaskOutput = {
  label: "relevant" | "unrelated";
  score: number;
  explanation: string;
};

const correctEvaluator = asEvaluator({
  name: "correctness",
  kind: "CODE",
  evaluate: async (args) => {
    const output = args.output as TaskOutput;
    const expected = args.expected as TaskOutput;
    const label = output.label === expected.label ? "correct" : "incorrect";
    const score = output.label === expected.label ? 1 : 0;
    return {
      label: label,
      score: score,
      explanation: `The evaluator labeled the answer as ${label}. Expected: ${expected?.label}`,
      metadata: {},
    };
  },
});

async function main() {
  const dataset = await createDataset({
    name: "document-relevancy-eval" + Math.random(),
    description: "Evaluate the relevancy of the model",
    examples: examples.map((example) => ({
      input: { question: example.input, documentText: example.documentText },
      output: {
        label: example.relevant ? "relevant" : "unrelated",
      },
      metadata: {},
    })),
  });

  const task: ExperimentTask = async (example) => {
    const evalResult = await relevanceEvaluator.evaluate({
      input: example.input.question as string,
      documentText: example.input.documentText as string,
    });

    return {
      ...evalResult,
    };
  };
  runExperiment({
    experimentName: "document-relevancy-eval",
    experimentDescription: "Evaluate the relevancy of the model",
    concurrency: 8,
    dataset: dataset,
    task,
    evaluators: [correctEvaluator],
  });
}

main();
