// Уроки. Этот файл обновляется раз в неделю: Claude пишет новую неделю после проверки.
// id урока не менять: по нему хранится прогресс.
// Типы заданий: ch — выбор, in — вставить слово, or — собрать предложение, tr — перевод.
window.LESSONS_DATE = '2026-10-02';

window.WEEKS = [
{w:1, t:'Я и моя работа', g:'a / an / the, my / his / her, am / is / are'},
{w:2, t:'Мой день, график 2 через 2', g:'Present Simple: don’t / doesn’t, вопросы'},
{w:3, t:'Что вокруг меня', g:'there is / there are, предлоги места, have'},
{w:4, t:'Моя история', g:'was / were, can'}];

window.LESSONS = [

// ---------- Неделя 1 ----------
{id:'w1l1', w:1, n:1, t:'I am a network engineer', g:'a / an',
rule:`<p>По-русски: «Я инженер». По-английски перед профессией и перед <b>одним</b> предметом нужно маленькое слово <b>a</b> или <b>an</b>.</p>
<p><b>a</b> — если слово начинается с <b>согласного звука</b>: a router, a cable, a network engineer.</p>
<p><b>an</b> — если с <b>гласного звука</b>: an engineer, an old car, an office.</p>
<p>Смотрим на звук, а не на букву: <b>a</b> user — слово звучит как «юзер», первый звук согласный.</p>
<p>Если предметов несколько, a / an не ставим: a router — routers.</p>`,
ex:[
['I am a network engineer.','Я сетевой инженер.'],
['She is an English teacher.','Она учительница английского.'],
['I have a laptop and a router.','У меня есть ноутбук и роутер.'],
['It is an old car.','Это старая машина.']],
text:[
['Hi! My name is Dan.','Привет! Меня зовут Дэн.'],
['I am a network engineer.','Я сетевой инженер.'],
['I work from home.','Я работаю из дома.'],
['I have a laptop and a router.','У меня есть ноутбук и роутер.'],
['I also have a dog. It is a small dog.','А ещё у меня есть собака. Это маленькая собака.'],
['And I have a car. It is an old car, but I like it.','И у меня есть машина. Это старая машина, но она мне нравится.'],
['My friend Kate is an English teacher.','Моя подруга Кейт — учительница английского.'],
['She is an interesting person.','Она интересный человек.']],
words:[
['engineer','инженер'],['network','сеть'],['work from home','работать из дома'],['laptop','ноутбук'],
['router','роутер, маршрутизатор'],['also','также, ещё'],['old','старый'],['but','но'],
['friend','друг, подруга'],['teacher','учитель'],['interesting','интересный'],['person','человек']],
tasks:[
{k:'ch', q:'What is Dan’s job? (Кем работает Дэн?)', o:['He is a network engineer.','He is an English teacher.','He is a builder.'], a:0},
{k:'ch', q:'Kate is…', o:['a network engineer','an English teacher','a builder'], a:1},
{k:'ch', q:'Dan’s car is…', o:['new','old','big'], a:1},
{k:'ch', q:'___ router', o:['a','an'], a:0, e:'router начинается с согласного звука [r].'},
{k:'ch', q:'___ engineer', o:['a','an'], a:1, e:'engineer начинается с гласного звука [e].'},
{k:'ch', q:'___ user', o:['a','an'], a:0, e:'user звучит как «юзер»: первый звук согласный.'},
{k:'ch', q:'It is ___ old laptop.', o:['a','an'], a:1, e:'Смотрим на следующее слово: old начинается с гласного.'},
{k:'in', q:'She is ___ teacher.', a:['a']},
{k:'in', q:'I have ___ office at home.', a:['an'], e:'office начинается с гласного звука.'},
{k:'or', ru:'Я сетевой инженер.', a:'I am a network engineer.'},
{k:'or', ru:'Это старая машина, но она мне нравится.', a:'It is an old car, but I like it.'},
{k:'tr', ru:'У меня есть ноутбук.', a:['I have a laptop.','I have got a laptop.','I’ve got a laptop.']}],
own:'Напиши 2–3 предложения о себе: кто ты по профессии и что у тебя есть. Не забудь a / an. Например: I am a network engineer. I have a dog.'},

{id:'w1l2', w:1, n:2, t:'The router is in the kitchen', g:'a и the',
rule:`<p><b>a / an</b> — «какой-то, один из многих». Говорим о предмете <b>первый раз</b>.</p>
<p><b>the</b> — «тот самый». Уже понятно, о каком предмете речь: о нём уже говорили, или он тут один такой.</p>
<p>I have <b>a</b> router. <b>The</b> router is old. — Сначала «есть роутер» (впервые), потом «этот роутер старый».</p>
<p><b>the</b> ставим и с одним предметом, и с несколькими: the router, the routers.</p>`,
ex:[
['I have a switch. The switch is old.','У меня есть коммутатор. Этот коммутатор старый.'],
['The router is in the kitchen.','Роутер (наш, понятно какой) — на кухне.'],
['Close the door, please.','Закрой дверь, пожалуйста.'],
['A cable goes from the switch to the router.','От коммутатора к роутеру идёт кабель.']],
text:[
['I have a small office at home.','У меня дома есть небольшой кабинет.'],
['The office is quiet.','В кабинете тихо.'],
['In the office, I have a desk, a laptop and a switch.','В кабинете у меня стол, ноутбук и коммутатор.'],
['The laptop is new, but the switch is old.','Ноутбук новый, а коммутатор старый.'],
['The switch has eight ports.','У коммутатора восемь портов.'],
['A cable goes from the switch to the router.','От коммутатора к роутеру идёт кабель.'],
['The router is in the kitchen.','Роутер стоит на кухне.'],
['The kitchen is not quiet. My dog plays there!','На кухне не тихо. Там играет моя собака!']],
words:[
['office','кабинет, офис'],['quiet','тихий'],['desk','рабочий стол'],['switch','коммутатор, свитч'],
['new','новый'],['port','порт'],['eight','восемь'],['cable','кабель'],
['go from … to …','идти от … к …'],['kitchen','кухня'],['small','маленький, небольшой'],['play','играть']],
tasks:[
{k:'ch', q:'Where is the router? (Где роутер?)', o:['in the office','in the kitchen','on the desk'], a:1},
{k:'ch', q:'The switch is…', o:['new','old','quiet'], a:1},
{k:'ch', q:'How many ports does the switch have? (Сколько портов?)', o:['four','six','eight'], a:2},
{k:'ch', q:'I have ___ new laptop.', o:['a','the'], a:0, e:'Говорим о ноутбуке впервые — a.'},
{k:'ch', q:'I have a new laptop. ___ laptop is fast.', o:['A','The'], a:1, e:'Этот ноутбук уже упоминали — the.'},
{k:'ch', q:'Where is ___ router? In the kitchen.', o:['a','the'], a:1, e:'Речь о нашем роутере, понятно каком — the.'},
{k:'in', q:'I have a dog. ___ dog is small.', a:['the'], e:'Собаку уже упоминали — the.'},
{k:'in', q:'Dan has ___ old car.', a:['an'], e:'Впервые и перед гласным звуком — an.'},
{k:'in', q:'Close ___ door, please.', a:['the'], e:'Понятно, какую дверь — the.'},
{k:'or', ru:'Роутер на кухне.', a:'The router is in the kitchen.'},
{k:'or', ru:'Ноутбук новый, а коммутатор старый.', a:'The laptop is new, but the switch is old.'},
{k:'tr', ru:'У меня есть стол. Стол маленький.', a:['I have a desk. The desk is small.','I have got a desk. The desk is small.','I have a desk. It is small.']}],
own:'Опиши своё рабочее место в 2–3 предложениях: что там есть. Сначала a, потом the. Например: I have a laptop. The laptop is old.'},

{id:'w1l3', w:1, n:3, t:'His name is Mike', g:'my / your / his / her / its / our / their',
rule:`<p>Чтобы сказать «чей», ставим слово перед предметом:</p>
<p><b>my</b> — мой · <b>your</b> — твой, ваш · <b>his</b> — его (о мужчине) · <b>her</b> — её · <b>its</b> — его, её (о предмете) · <b>our</b> — наш · <b>their</b> — их</p>
<p>С этими словами <b>a / the не ставим</b>: my car, а не <s>my a car</s>.</p>
<p><b>his</b> или <b>her</b> — смотрим, чей предмет: Kate and <b>her</b> laptop, Mike and <b>his</b> laptop. О домашних животных с кличкой тоже говорят his / her: This is my dog. <b>His</b> name is Rex.</p>
<p>Не путай: <b>its</b> — «его / её» (чей), <b>it’s</b> = it is (это). The switch is old. <b>Its</b> ports are slow. <b>It’s</b> an old switch.</p>`,
ex:[
['My name is Dan.','Меня зовут Дэн.'],
['Kate is my team leader. Her laptop is new.','Кейт — мой руководитель. Её ноутбук новый.'],
['Mike is an engineer. His home is in a small town.','Майк — инженер. Его дом в маленьком городке.'],
['The switch is old. Its ports are slow.','Коммутатор старый. Его порты медленные.'],
['We have a big network. Our network is fast.','У нас большая сеть. Наша сеть быстрая.']],
text:[
['I work in a small team.','Я работаю в небольшой команде.'],
['Kate is my team leader. Her office is in the city.','Кейт — мой руководитель. Её офис в городе.'],
['Mike is a network engineer too. His home is in a small town.','Майк тоже сетевой инженер. Его дом в маленьком городке.'],
['His internet is slow, and he is not happy.','Интернет у него медленный, и он недоволен.'],
['We have a big network. Our network has two hundred switches.','У нас большая сеть. В нашей сети двести коммутаторов.'],
['Our users are in five offices. Their offices are in different cities.','Наши пользователи сидят в пяти офисах. Их офисы в разных городах.'],
['And this is my dog, Rex. He is not in the team, but his place is under my desk.','А это мой пёс Рекс. Он не в команде, но его место — под моим столом.']],
words:[
['team','команда'],['team leader','руководитель команды'],['city','город (большой)'],['town','городок'],
['too','тоже (в конце фразы)'],['slow','медленный'],['happy','довольный, счастливый'],['big','большой'],
['two hundred','двести'],['user','пользователь'],['different','разный'],['under','под'],['place','место']],
tasks:[
{k:'ch', q:'Who is Dan’s team leader?', o:['Mike','Kate','Rex'], a:1},
{k:'ch', q:'Mike’s internet is…', o:['fast','slow','new'], a:1},
{k:'ch', q:'Where is Rex’s place?', o:['in the kitchen','under the desk','in the city'], a:1},
{k:'ch', q:'Kate has a laptop. ___ laptop is new.', o:['His','Her','Its'], a:1, e:'Кейт — женщина, поэтому her.'},
{k:'ch', q:'Mike has a car. ___ car is old.', o:['His','Her','Their'], a:0, e:'Майк — мужчина, поэтому his.'},
{k:'ch', q:'The router is old. ___ ports are slow.', o:['It’s','Its','His'], a:1, e:'Its — «его» про предмет. It’s = it is.'},
{k:'ch', q:'We have an office. ___ office is small.', o:['Our','Their','My'], a:0},
{k:'ch', q:'This is ___ car.', o:['my','my a','a my'], a:0, e:'С my, his, her артикль не нужен.'},
{k:'in', q:'I am Dan. ___ name is Dan.', a:['my']},
{k:'in', q:'Kate and Mike have laptops. ___ laptops are new.', a:['their'], e:'Кейт и Майк — это «они», поэтому their.'},
{k:'or', ru:'Её офис в городе.', a:'Her office is in the city.'},
{k:'tr', ru:'Моя машина старая, но хорошая.', a:['My car is old, but it is good.','My car is old, but good.','My car is old, but it is a good car.']},
{k:'tr', ru:'Его зовут Майк.', a:['His name is Mike.','He is Mike.']}],
own:'Напиши 2–3 предложения о своих вещах или близких. Используй my, his, her, its. Например: My laptop is old. Its screen is small.'},

{id:'w1l4', w:1, n:4, t:'Is the link up?', g:'am / is / are: не и вопрос',
rule:`<p>Глагол «быть»: I <b>am</b> · he / she / it <b>is</b> · we / you / they <b>are</b>.</p>
<p><b>Отрицание</b> — ставим not после глагола: I am <b>not</b> · it is not = it <b>isn’t</b> · they are not = they <b>aren’t</b>.</p>
<p><b>Вопрос</b> — меняем местами: It is up. → <b>Is it</b> up? You are at work. → <b>Are you</b> at work?</p>
<p>Короткий ответ: Yes, it is. / No, it isn’t. · Yes, I am. / No, I’m not.</p>
<p>В сетях <b>up</b> — работает, <b>down</b> — не работает (линк, порт, сайт).</p>`,
ex:[
['The link is down.','Линк упал (не работает).'],
['Is the port up? — No, it isn’t.','Порт работает? — Нет.'],
['Are you at work? — Yes, I am.','Ты на работе? — Да.'],
['The users aren’t happy.','Пользователи недовольны.']],
text:[
['Kate: Hi, Dan! Are you at work?','Кейт: Привет, Дэн! Ты на работе?'],
['Dan: Yes, I am. What is the problem?','Дэн: Да. Что случилось?'],
['Kate: Office 3 is offline. Is the link up?','Кейт: Офис 3 недоступен. Линк работает?'],
['Dan: No, it isn’t. The link is down.','Дэн: Нет. Линк лежит.'],
['Kate: Is the cable OK?','Кейт: С кабелем всё в порядке?'],
['Dan: Yes, it is. The cable is fine. The problem is the port.','Дэн: Да. Кабель в порядке. Проблема в порте.'],
['Kate: Are the users angry?','Кейт: Пользователи злятся?'],
['Dan: No, they aren’t. It is two a.m. They are at home!','Дэн: Нет. Сейчас два часа ночи. Они дома!']],
words:[
['problem','проблема'],['offline','не в сети, недоступен'],['link','канал связи, линк'],['up','работает (о сети)'],
['down','не работает (о сети)'],['fine','в порядке'],['angry','злой, сердитый'],['at work','на работе'],
['at home','дома'],['a.m.','до полудня (2 a.m. — 2 часа ночи)']],
tasks:[
{k:'ch', q:'Is the link up?', o:['Yes, it is.','No, it isn’t.'], a:1},
{k:'ch', q:'Is the cable OK?', o:['Yes, it is.','No, it isn’t.'], a:0},
{k:'ch', q:'What is the problem?', o:['the cable','the port','the users'], a:1},
{k:'ch', q:'Are the users angry?', o:['Yes, they are.','No, they aren’t.'], a:1},
{k:'ch', q:'I ___ at work.', o:['am','is','are'], a:0},
{k:'ch', q:'The users ___ at home.', o:['am','is','are'], a:2, e:'users — их много, это «они»: are.'},
{k:'ch', q:'___ the port down?', o:['Is','Are','Am'], a:0, e:'the port — один, «он»: is. В вопросе is встаёт первым.'},
{k:'in', q:'The link isn’t up. It is ___.', a:['down']},
{k:'in', q:'They ___ not happy.', a:['are']},
{k:'or', ru:'Ты на работе?', a:'Are you at work?'},
{k:'or', ru:'Порт не работает?', a:'Is the port down?'},
{k:'tr', ru:'Кабель в порядке, но порт не работает.', a:['The cable is fine, but the port is down.','The cable is OK, but the port is down.','The cable is fine, but the port isn’t up.']},
{k:'tr', ru:'Я не дома.', a:['I am not at home.']}],
own:'Напиши 2–3 предложения про сейчас: где ты, что работает, а что нет. Используй is / are / not. Например: I am at home. My internet is up.'},

{id:'w1l5', w:1, n:5, t:'This is Dan', g:'рассказ о человеке',
rule:`<p>Собираем всё вместе, чтобы рассказать о человеке:</p>
<p>кто он: He <b>is a</b> network engineer.<br>чьё: <b>His</b> job is interesting.<br>что у него есть: He <b>has a</b> dog.<br>чего нет или что не так: It <b>isn’t</b> easy.</p>
<p><b>have → has</b> для he / she / it: I have a car. Dan <b>has</b> a car.</p>
<p>Порядок слов в английском почти всегда один: <b>кто → действие → остальное</b>. Dan works from home.</p>`,
ex:[
['Dan is a network engineer.','Дэн — сетевой инженер.'],
['His job isn’t easy, but it is interesting.','Работа у него непростая, но интересная.'],
['He has a dog. His name is Rex.','У него есть пёс. Его зовут Рекс.'],
['Kate has an old car.','У Кейт старая машина.']],
text:[
['This is Dan. He is a network engineer.','Это Дэн. Он сетевой инженер.'],
['He is thirty-two.','Ему тридцать два.'],
['His job isn’t easy, but it is interesting.','Работа у него непростая, но интересная.'],
['He works from home. His office is small and quiet.','Он работает из дома. Его кабинет маленький и тихий.'],
['The office has a desk, a laptop and an old switch.','В кабинете есть стол, ноутбук и старый коммутатор.'],
['Dan has a dog. His name is Rex.','У Дэна есть пёс. Его зовут Рекс.'],
['Rex is a good dog, but he isn’t quiet!','Рекс хороший пёс, но совсем не тихий!'],
['Dan has a car too. It is an old Ford, but it is a good car.','У Дэна есть и машина. Это старый «Форд», но машина хорошая.']],
words:[
['job','работа, должность'],['easy','лёгкий, простой'],['thirty-two','тридцать два'],['he has','у него есть'],
['good','хороший'],['this is…','это… (когда знакомишь)']],
tasks:[
{k:'ch', q:'How old is Dan? (Сколько ему лет?)', o:['twenty-two','thirty-two','forty-two'], a:1},
{k:'ch', q:'Is his job easy?', o:['Yes, it is.','No, it isn’t.'], a:1},
{k:'ch', q:'Is Rex quiet?', o:['Yes, he is.','No, he isn’t.'], a:1},
{k:'ch', q:'Dan ___ a dog.', o:['have','has','is'], a:1, e:'he / she / it → has.'},
{k:'ch', q:'Kate ___ a team leader.', o:['is','has','are'], a:0, e:'Кто она? — is.'},
{k:'ch', q:'He is ___ engineer.', o:['a','an','the'], a:1},
{k:'in', q:'Dan has a car. ___ car is old.', a:['his']},
{k:'in', q:'Kate ___ an old laptop.', a:['has']},
{k:'in', q:'His job ___ easy. (не лёгкая)', a:['isn’t','is not','isnt']},
{k:'or', ru:'У него есть старая машина.', a:'He has an old car.'},
{k:'or', ru:'Его работа интересная.', a:'His job is interesting.'},
{k:'tr', ru:'Это Кейт. Она руководитель команды.', a:['This is Kate. She is a team leader.','This is Kate. She is the team leader.','This is Kate. She is our team leader.']},
{k:'tr', ru:'У неё есть собака.', a:['She has a dog.','She has got a dog.','She’s got a dog.']}],
own:'Главное задание недели. Напиши 5–6 предложений о себе: кто ты, какая у тебя работа, что у тебя есть (дом, собака, машина). Используй a / an / the, my / his / her, is / isn’t, has. Потом прочитай вслух.'},

{id:'w1r', w:1, n:6, review:true, t:'Повторение недели', g:'всё вместе',
tasks:[
{k:'ch', q:'I am ___ engineer.', o:['a','an'], a:1},
{k:'ch', q:'It is ___ router.', o:['a','an'], a:0},
{k:'ch', q:'I have a laptop. ___ laptop is new.', o:['A','The'], a:1},
{k:'ch', q:'Kate is my team leader. ___ desk is big.', o:['His','Her','Its'], a:1},
{k:'ch', q:'The switch is new. ___ ports are fast.', o:['It’s','Its'], a:1},
{k:'ch', q:'___ the users at work?', o:['Is','Are','Am'], a:1},
{k:'ch', q:'Mike ___ a small house.', o:['have','has'], a:1},
{k:'in', q:'The link isn’t up. It is ___.', a:['down']},
{k:'in', q:'We have a big network. ___ network is fast.', a:['our']},
{k:'in', q:'I ___ not at home.', a:['am']},
{k:'or', ru:'Её ноутбук на кухне.', a:'Her laptop is in the kitchen.'},
{k:'or', ru:'Это старый коммутатор, но он работает.', a:'It is an old switch, but it is up.'},
{k:'tr', ru:'Я сетевой инженер. Я работаю из дома.', a:['I am a network engineer. I work from home.','I am a network engineer. I work at home.']},
{k:'tr', ru:'Порт не работает?', a:['Is the port down?','Is the port not up?','Isn’t the port up?']},
{k:'tr', ru:'Его машина старая, но хорошая.', a:['His car is old, but good.','His car is old, but it is good.','His car is old, but it is a good car.']}],
own:'Перепиши свой рассказ о себе из урока 1.5 начисто, без подсказок. Прочитай вслух и продиктуй телефону на английском. Этот текст попадёт в отчёт для Claude.'}

];
