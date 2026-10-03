// Уроки. Этот файл обновляется раз в неделю: Claude пишет новую неделю после проверки.
// id урока не менять: по нему хранится прогресс.
// Типы заданий: ch — выбор, in — вставить слово, or — собрать предложение, tr — перевод,
// fx — исправить ошибку (проверка с учётом больших букв), dc — диктант: послушать и написать.
window.LESSONS_DATE = '2026-10-03';

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
{k:'in', q:'We have a big network. ___ network is fast.', a:['our','the'], e:'Подходят оба: our — «наша», the — «эта, о которой говорили».'},
{k:'in', q:'I ___ not at home.', a:['am']},
{k:'or', ru:'Её ноутбук на кухне.', a:'Her laptop is in the kitchen.'},
{k:'or', ru:'Это старый коммутатор, но он работает.', a:'It is an old switch, but it is up.'},
{k:'tr', ru:'Я сетевой инженер. Я работаю из дома.', a:['I am a network engineer. I work from home.','I am a network engineer. I work at home.']},
{k:'tr', ru:'Порт не работает?', a:['Is the port down?','Is the port not up?','Isn’t the port up?']},
{k:'tr', ru:'Его машина старая, но хорошая.', a:['His car is old, but good.','His car is old, but it is good.','His car is old, but it is a good car.']}],
own:'Перепиши свой рассказ о себе из урока 1.5 начисто, без подсказок. Прочитай вслух и продиктуй телефону на английском. Этот текст попадёт в отчёт для Claude.'},

// ---------- Неделя 2 ----------
{id:'w2l1', w:2, n:1, t:'I work two days on, two days off', g:'Present Simple: he works',
rule:`<p><b>Present Simple</b> — то, что бывает регулярно: работа, привычки, расписание.</p>
<p>I / you / we / they <b>work</b>. He / she / it <b>works</b> — с he, she, it глагол получает <b>-s</b>.</p>
<p>Как добавлять -s:<br>обычно <b>+s</b>: work → works, start → starts<br>после s, sh, ch, x, o — <b>+es</b>: watch → watches, go → goes, do → does, fix → fixes<br>согласная + y → <b>-ies</b>: study → studies; но гласная + y → +s: play → plays<br>исключение: have → <b>has</b></p>
<p>Слова времени: every day — каждый день, in the morning — утром, at night — ночью, at 8 a.m. — в 8 утра, at 8 p.m. — в 8 вечера.</p>`,
ex:[
['I work two days on, two days off.','Я работаю два дня, потом два дня отдыхаю.'],
['Dan starts work at 8 a.m.','Дэн начинает работу в 8 утра.'],
['He watches the network all day.','Он весь день следит за сетью.'],
['Kate studies English every evening.','Кейт каждый вечер учит английский.']],
text:[
['Hi, it’s Dan again. I work for an internet provider.','Привет, это снова Дэн. Я работаю в интернет-провайдере.'],
['I work in shifts: two days on, two days off.','Я работаю сменами: два дня работаю, два дня отдыхаю.'],
['On a work day, I get up at 7 a.m.','В рабочий день я встаю в 7 утра.'],
['I make coffee and turn on my laptop.','Я варю кофе и включаю ноутбук.'],
['My shift starts at 8 a.m. and ends at 8 p.m.','Моя смена начинается в 8 утра и заканчивается в 8 вечера.'],
['I check the network and answer messages from the support team.','Я проверяю сеть и отвечаю на сообщения от поддержки.'],
['Users call the support team when they have no internet.','Пользователи звонят в поддержку, когда у них нет интернета.'],
['Then the support team writes to me.','Потом поддержка пишет мне.'],
['I find the problem and fix it.','Я нахожу проблему и устраняю её.'],
['My colleague Mike works at night.','Мой коллега Майк работает ночью.'],
['He starts at 8 p.m. and finishes at 8 a.m.','Он начинает в 8 вечера и заканчивает в 8 утра.'],
['He drinks a lot of tea and watches the alarms.','Он пьёт много чая и следит за авариями.'],
['On my days off, I sleep, walk my dog and study English.','В выходные я сплю, гуляю с собакой и учу английский.'],
['Kate, my team leader, often says: “Rest is part of the job.”','Кейт, мой руководитель, часто говорит: «Отдых — часть работы».']],
words:[
['internet provider','интернет-провайдер'],['shift','смена'],['day off','выходной (days off — выходные)'],['get up','вставать'],
['turn on','включать'],['start','начинать(ся)'],['end','заканчивать(ся)'],['finish','заканчивать'],
['answer','отвечать'],['support team','служба поддержки'],['fix','чинить, устранять'],['colleague','коллега'],['alarm','авария, тревожный сигнал']],
tasks:[
{k:'ch', q:'When does Dan’s shift start?', o:['at 7 a.m.','at 8 a.m.','at 8 p.m.'], a:1},
{k:'ch', q:'Who works at night?', o:['Dan','Kate','Mike'], a:2},
{k:'ch', q:'What does the support team do?', o:['They fix the network.','They take calls from users and write to Dan.','They watch the alarms at night.'], a:1},
{k:'ch', q:'What does Dan do on his days off?', o:['He works at night.','He sleeps, walks his dog and studies English.','He fixes the network.'], a:1},
{k:'ch', q:'He ___ at 8 p.m.', o:['start','starts'], a:1, e:'he → глагол с -s.'},
{k:'ch', q:'They ___ tea at work.', o:['drink','drinks'], a:0, e:'they → без -s.'},
{k:'ch', q:'Mike ___ the alarms.', o:['watchs','watches'], a:1, e:'После ch добавляем -es.'},
{k:'ch', q:'Kate ___ English every evening.', o:['studys','studies','study'], a:1, e:'Согласная + y → -ies.'},
{k:'in', q:'My shift ___ at 8 p.m. (end)', a:['ends']},
{k:'in', q:'Dan ___ a dog. (have)', a:['has']},
{k:'fx', q:'he work at night.', a:['He works at night.'], e:'Предложение начинается с большой буквы, а после he глагол с -s.'},
{k:'fx', q:'i get up at 7 a.m.', a:['I get up at 7 a.m.','I get up at seven a.m.'], e:'I — всегда с большой буквы.'},
{k:'dc', a:['I work two days on, two days off.'], ru:'Я работаю два дня, потом два дня отдыхаю.'},
{k:'tr', ru:'Моя смена начинается в 8 утра.', a:['My shift starts at 8 a.m.','My shift begins at 8 a.m.','My shift starts at 8 in the morning.','My shift starts at eight a.m.']},
{k:'tr', ru:'Он работает ночью.', a:['He works at night.']},
{k:'tr', ru:'Я проверяю сеть каждый день.', a:['I check the network every day.','Every day I check the network.','I check my network every day.']}],
own:'Опиши свой рабочий день в 5–6 предложениях: когда встаёшь, когда начинается и заканчивается смена, что делаешь. Используй Present Simple: I get up…, My shift starts…'},

{id:'w2l2', w:2, n:2, t:'I don’t set an alarm', g:'don’t / doesn’t',
rule:`<p><b>Отрицание</b> в Present Simple:</p>
<p>I / you / we / they <b>don’t</b> (do not) + глагол<br>he / she / it <b>doesn’t</b> (does not) + глагол</p>
<p>После doesn’t окончание -s <b>пропадает</b>: He works → He <b>doesn’t work</b>, а не <s>doesn’t works</s>. Окончание уже «забрал» does.</p>
<p>С am / is / are do <b>не нужен</b>: He isn’t at work. — а не <s>He doesn’t at work</s>.</p>`,
ex:[
['I don’t work on my days off.','Я не работаю в выходные.'],
['Mike doesn’t sleep at night.','Майк не спит ночью.'],
['The router doesn’t work.','Роутер не работает.'],
['She isn’t at home. She doesn’t work from home.','Её нет дома. Она не работает из дома.']],
text:[
['Today is my day off.','Сегодня у меня выходной.'],
['I don’t set an alarm, and I don’t open my work chat.','Я не ставлю будильник и не открываю рабочий чат.'],
['Mike works today, so the network isn’t my problem.','Сегодня работает Майк, так что сеть — не моя проблема.'],
['But my dog Rex doesn’t understand days off.','Но мой пёс Рекс не понимает, что такое выходные.'],
['He wants a walk at 7 a.m. every day!','Он хочет гулять в 7 утра каждый день!'],
['After the walk, I go to the gym. It’s near my home.','После прогулки я иду в спортзал. Он рядом с домом.'],
['I don’t lift very heavy weights. I run and do simple exercises.','Я не поднимаю очень тяжёлые веса. Я бегаю и делаю простые упражнения.'],
['In the afternoon, I read a book or study English.','Днём я читаю книгу или учу английский.'],
['I don’t watch videos for hours. My phone stays in another room.','Я не смотрю видео часами. Телефон лежит в другой комнате.'],
['My friend Kate doesn’t have days off this week.','У моей подруги Кейт на этой неделе нет выходных.'],
['She doesn’t complain. She just drinks more coffee.','Она не жалуется. Она просто пьёт больше кофе.'],
['Tomorrow I work again, and Mike doesn’t.','Завтра снова работаю я, а Майк — нет.']],
words:[
['today','сегодня'],['set an alarm','ставить будильник'],['understand','понимать'],['want','хотеть'],
['walk','прогулка; гулять'],['gym','спортзал'],['near','рядом с'],['heavy','тяжёлый'],
['afternoon','день (после полудня)'],['for hours','часами'],['complain','жаловаться'],['tomorrow','завтра'],['again','снова']],
tasks:[
{k:'ch', q:'Why does Dan get up early on his day off?', o:['He works.','His dog wants a walk.','Mike calls him.'], a:1},
{k:'ch', q:'Who works today?', o:['Dan','Mike','Kate'], a:1},
{k:'ch', q:'Where is Dan’s phone in the afternoon?', o:['In his hand.','In another room.','At the gym.'], a:1},
{k:'ch', q:'Does Kate have days off this week?', o:['Yes, she does.','No, she doesn’t.'], a:1},
{k:'ch', q:'Mike ___ sleep at night.', o:['don’t','doesn’t'], a:1},
{k:'ch', q:'I ___ check the alarms on my days off.', o:['don’t','doesn’t'], a:0},
{k:'ch', q:'He doesn’t ___ the alarms.', o:['check','checks'], a:0, e:'После doesn’t глагол без -s.'},
{k:'ch', q:'She ___ at work today.', o:['doesn’t','isn’t'], a:1, e:'at work — где она, это глагол be: isn’t.'},
{k:'in', q:'The switch ___ work. (не работает)', a:['doesn’t','does not','doesnt']},
{k:'in', q:'We ___ work on Sundays. (не работаем)', a:['don’t','do not','dont']},
{k:'fx', q:'He don’t work today.', a:['He doesn’t work today.','He does not work today.'], e:'he → doesn’t.'},
{k:'fx', q:'My dog doesn’t understands days off.', a:['My dog doesn’t understand days off.','My dog does not understand days off.'], e:'После doesn’t глагол без -s.'},
{k:'dc', a:['My phone stays in another room.'], ru:'Мой телефон лежит в другой комнате.'},
{k:'tr', ru:'Я не работаю в выходные.', a:['I don’t work on my days off.','I don’t work on days off.','I don’t work on weekends.','I don’t work at the weekend.','I don’t work on my day off.']},
{k:'tr', ru:'Он не пьёт кофе.', a:['He doesn’t drink coffee.']},
{k:'tr', ru:'Интернет не работает.', a:['The internet doesn’t work.','The internet is down.','The internet isn’t working.','Internet doesn’t work.']}],
own:'Напиши 5–6 предложений о своём выходном: что ты делаешь и чего НЕ делаешь. Используй don’t / doesn’t. Например: I don’t set an alarm. My dog doesn’t…'},

{id:'w2l3', w:2, n:3, t:'Do you work at night?', g:'вопросы с do / does',
rule:`<p><b>Вопрос</b> в Present Simple начинается с do или does:</p>
<p><b>Do</b> + I / you / we / they + глагол? — Do you work at night?<br><b>Does</b> + he / she / it + глагол? — Does Mike work at night?</p>
<p>В вопросе -s тоже пропадает: <b>Does he work</b>…? — а не <s>Does he works</s>.</p>
<p>Короткий ответ: Yes, I do. / No, I don’t. · Yes, he does. / No, he doesn’t.</p>
<p>С am / is / are do не нужен: Are you tired? — Yes, I am.</p>`,
ex:[
['Do you work at night? — No, I don’t.','Ты работаешь ночью? — Нет.'],
['Does Mike drink coffee? — No, he doesn’t. He drinks tea.','Майк пьёт кофе? — Нет. Он пьёт чай.'],
['Does the router have Wi-Fi? — Yes, it does.','У роутера есть Wi-Fi? — Да.'],
['Are you tired? — Yes, I am.','Ты устал? — Да.']],
text:[
['Sam is a new engineer in our team. Today he asks me a lot of questions.','Сэм — новый инженер в нашей команде. Сегодня он задаёт мне много вопросов.'],
['Sam: Do you work every day?','Сэм: Ты работаешь каждый день?'],
['Dan: No, I don’t. I work two days on, two days off.','Дэн: Нет. Два дня работаю, два отдыхаю.'],
['Sam: Do you work at night?','Сэм: Ты работаешь ночью?'],
['Dan: No, I don’t. Mike works at night.','Дэн: Нет. Ночью работает Майк.'],
['Sam: Does Mike like night shifts?','Сэм: Майку нравятся ночные смены?'],
['Dan: Yes, he does. He says the night is quiet.','Дэн: Да. Он говорит, что ночью тихо.'],
['Sam: Does the support team call you?','Сэм: Поддержка тебе звонит?'],
['Dan: No, they don’t. They write in the chat.','Дэн: Нет. Они пишут в чат.'],
['Sam: Do we have a lot of switches?','Сэм: У нас много коммутаторов?'],
['Dan: Yes, we do. We have about two thousand switches in the city.','Дэн: Да. В городе около двух тысяч коммутаторов.'],
['Sam: Does every switch have a name?','Сэм: У каждого коммутатора есть имя?'],
['Dan: Yes, it does. The name shows the street and the house.','Дэн: Да. Имя показывает улицу и дом.'],
['Sam: Do you know all the names?','Сэм: Ты знаешь все имена?'],
['Dan: No, I don’t! But I know where to look.','Дэн: Нет! Но я знаю, где посмотреть.']],
words:[
['ask','спрашивать'],['question','вопрос'],['every day','каждый день'],['night shift','ночная смена'],
['like','нравиться, любить'],['call','звонить'],['a lot of','много'],['about','около, примерно'],
['thousand','тысяча'],['street','улица'],['house','дом (здание)'],['know','знать'],['where to look','где посмотреть']],
tasks:[
{k:'ch', q:'Does Dan work every day?', o:['Yes, he does.','No, he doesn’t.'], a:1},
{k:'ch', q:'Does Mike like night shifts?', o:['Yes, he does.','No, he doesn’t.'], a:0},
{k:'ch', q:'How does the support team talk to Dan?', o:['They call him.','They write in the chat.','They come to his home.'], a:1},
{k:'ch', q:'What does a switch name show?', o:['the street and the house','the user’s name','the time'], a:0},
{k:'ch', q:'___ you like coffee?', o:['Do','Does','Are'], a:0},
{k:'ch', q:'___ Kate work from home?', o:['Do','Does','Is'], a:1},
{k:'ch', q:'Does he ___ English?', o:['speak','speaks'], a:0, e:'После does глагол без -s.'},
{k:'ch', q:'___ you tired?', o:['Do','Are'], a:1, e:'tired — состояние, это глагол be: Are you tired?'},
{k:'in', q:'Do you work at night? — No, I ___.', a:['don’t','do not','dont']},
{k:'in', q:'Does the switch have a name? — Yes, it ___.', a:['does']},
{k:'fx', q:'Does he works at night?', a:['Does he work at night?'], e:'После does глагол без -s.'},
{k:'fx', q:'do you like your job?', a:['Do you like your job?'], e:'Вопрос — тоже предложение: с большой буквы.'},
{k:'or', ru:'Майк работает ночью?', a:'Does Mike work at night?'},
{k:'dc', a:['Do you know all the names?'], ru:'Ты знаешь все имена?'},
{k:'tr', ru:'Ты работаешь из дома?', a:['Do you work from home?','Do you work at home?']},
{k:'tr', ru:'У него есть машина?', a:['Does he have a car?','Has he got a car?']}],
own:'Напиши 4 вопроса, которые ты бы задал новому коллеге, и ответь на них за себя полным ответом. Например: Do you work at night? — No, I don’t. I work during the day.'},

{id:'w2l4', w:2, n:4, t:'What time does your shift start?', g:'what, where, when, who, how',
rule:`<p>Вопросительное слово ставим <b>в начало</b>, дальше — как в обычном вопросе:</p>
<p><b>What time do</b> you start? · <b>Where does</b> he work? · <b>What do</b> you check first?</p>
<p>what — что, какой · where — где, куда · when — когда · what time — во сколько · who — кто · how — как · how often — как часто</p>
<p>Если спрашиваем «<b>кто</b> делает?» — do не нужен, глагол как с he: <b>Who works</b> at night? — Mike does.</p>`,
ex:[
['What time does your shift start? — At 8 a.m.','Во сколько начинается твоя смена? — В 8 утра.'],
['Where does Mike live? — In a small town.','Где живёт Майк? — В маленьком городке.'],
['What do you check first? — The alarms.','Что ты проверяешь первым? — Аварии.'],
['Who works at night? — Mike does.','Кто работает ночью? — Майк.']],
text:[
['Many people use the internet every day, but they don’t think about it.','Многие пользуются интернетом каждый день, но не думают о нём.'],
['Who keeps it up? Network engineers do.','Кто поддерживает его работу? Сетевые инженеры.'],
['Dan works for a small internet provider in his city.','Дэн работает в небольшом интернет-провайдере в своём городе.'],
['What does he do? He watches the network and fixes problems.','Чем он занимается? Следит за сетью и устраняет проблемы.'],
['Where does he work? He works from home, but sometimes he goes to the office.','Где он работает? Из дома, но иногда ездит в офис.'],
['When does he start? His shift starts at 8 a.m.','Когда он начинает? Его смена начинается в 8 утра.'],
['What does he check first? He checks the alarms.','Что он проверяет первым? Аварии.'],
['An alarm shows that something is down: a switch, a link or a port.','Авария показывает, что что-то упало: коммутатор, линк или порт.'],
['How does he find the problem? He logs in to the switch and looks at the ports.','Как он находит проблему? Заходит на коммутатор и смотрит порты.'],
['Sometimes the problem is simple: a user’s cable is broken.','Иногда проблема простая: у пользователя сломан кабель.'],
['Sometimes it is hard, and Dan asks Kate for help.','Иногда сложная, и Дэн просит Кейт о помощи.'],
['How often does the network go down? Not often, but every day something happens.','Как часто сеть падает? Не часто, но каждый день что-то случается.'],
['What does Dan like about his job? He likes to find the problem.','Что Дэну нравится в работе? Ему нравится находить проблему.'],
['What doesn’t he like? He doesn’t like night calls.','Что ему не нравится? Ночные звонки.']],
words:[
['think about','думать о'],['keep up','поддерживать работу'],['sometimes','иногда'],['first','первым, сначала'],
['something','что-то'],['log in to','заходить на (устройство)'],['broken','сломанный'],['hard','трудный'],
['ask for help','просить о помощи'],['how often','как часто'],['happen','случаться'],['often','часто']],
tasks:[
{k:'ch', q:'What does Dan check first?', o:['the users','the alarms','his car'], a:1},
{k:'ch', q:'Where does Dan work?', o:['Only in the office.','From home, and sometimes in the office.','At the gym.'], a:1},
{k:'ch', q:'Who helps Dan with hard problems?', o:['Sam','Mike','Kate'], a:2},
{k:'ch', q:'What doesn’t Dan like?', o:['finding problems','night calls','his team'], a:1},
{k:'ch', q:'___ does your shift start? — At 8 a.m.', o:['Where','What time','Who'], a:1},
{k:'ch', q:'___ does Mike live? — In a small town.', o:['Where','When','What'], a:0},
{k:'ch', q:'Who ___ at night?', o:['work','works','does work'], a:1, e:'Вопрос «кто?» — без do, глагол как с he: Who works?'},
{k:'ch', q:'What ___ Kate do at work?', o:['do','does','is'], a:1},
{k:'in', q:'___ often do you go to the gym? (как часто)', a:['how']},
{k:'in', q:'What time ___ you get up?', a:['do']},
{k:'or', ru:'Где ты работаешь?', a:'Where do you work?'},
{k:'or', ru:'Во сколько он заканчивает?', a:'What time does he finish?'},
{k:'fx', q:'Where Dan works?', a:['Where does Dan work?'], e:'Нужен does, а глагол — без -s.'},
{k:'dc', a:['What does he check first?'], ru:'Что он проверяет первым?'},
{k:'tr', ru:'Что ты делаешь на работе?', a:['What do you do at work?']},
{k:'tr', ru:'Когда начинается твоя смена?', a:['When does your shift start?','What time does your shift start?']}],
own:'Ответь полными предложениями: What do you do at work? What do you check first? What time does your shift start? What do you like about your job? What don’t you like?'},

{id:'w2l5', w:2, n:5, t:'I always check the alarms', g:'always, usually, never + its / it’s',
rule:`<p><b>Как часто:</b> always (всегда) → usually (обычно) → often (часто) → sometimes (иногда) → never (никогда).</p>
<p><b>Место в предложении:</b> перед обычным глаголом, но после am / is / are.<br>I <b>always check</b> the alarms. · He <b>is never</b> late.</p>
<p>never — уже отрицание: I never watch TV. Не <s>I don’t never</s>.</p>
<p><b>Повторим трудное прошлой недели:</b><br><b>its</b> — «его / её» (чей): The switch is old. <b>Its</b> fan is loud.<br><b>it’s</b> = it is: <b>It’s</b> an old switch.<br>Проверка: если можно сказать «it is» — пиши it’s. Если нельзя — its.</p>`,
ex:[
['I always check the alarms first.','Я всегда первым делом проверяю аварии.'],
['Mike is never late.','Майк никогда не опаздывает.'],
['We sometimes go to the office.','Мы иногда ездим в офис.'],
['It’s a good switch. Its ports are fast.','Это хороший коммутатор. Его порты быстрые.']],
text:[
['I have some good habits and some bad habits.','У меня есть хорошие привычки и плохие.'],
['I always make coffee before my shift.','Я всегда варю кофе перед сменой.'],
['I usually check the alarms first and then read the chat.','Обычно я сначала проверяю аварии, а потом читаю чат.'],
['I often write notes about problems. My notes help me next time.','Я часто записываю заметки о проблемах. Заметки помогают мне в следующий раз.'],
['I sometimes forget to eat lunch. That is a bad habit.','Иногда я забываю пообедать. Это плохая привычка.'],
['Mike is never late, and he never forgets his tea.','Майк никогда не опаздывает и никогда не забывает свой чай.'],
['Kate is always calm. When the network is down, she doesn’t panic.','Кейт всегда спокойна. Когда сеть падает, она не паникует.'],
['She usually says: “Let’s look at the logs.”','Обычно она говорит: «Давай посмотрим логи».'],
['Our office has an old switch. It’s very old, but it works.','В нашем офисе есть старый коммутатор. Он очень старый, но работает.'],
['Its fan is loud, and its lights are always on.','Его вентилятор громкий, а лампочки всегда горят.'],
['Kate never turns it off. She says it’s part of our history.','Кейт никогда его не выключает. Она говорит, что это часть нашей истории.'],
['On my days off, I usually walk my dog in the morning.','В выходные я обычно гуляю с собакой утром.'],
['I never take my work laptop to the park.','Я никогда не беру рабочий ноутбук в парк.']],
words:[
['habit','привычка'],['before','перед, до'],['usually','обычно'],['notes','заметки'],
['forget','забывать'],['lunch','обед'],['late','опоздавший (be late — опаздывать)'],['calm','спокойный'],
['panic','паниковать'],['logs','логи, журналы'],['fan','вентилятор'],['loud','громкий'],['never','никогда']],
tasks:[
{k:'ch', q:'What does Dan always do before his shift?', o:['He walks his dog.','He makes coffee.','He reads the chat.'], a:1},
{k:'ch', q:'What is Dan’s bad habit?', o:['He is late.','He sometimes forgets to eat lunch.','He never writes notes.'], a:1},
{k:'ch', q:'What does Kate usually say when the network is down?', o:['Let’s look at the logs.','Turn it off.','Call Mike.'], a:0},
{k:'ch', q:'Why is the old switch still on?', o:['Kate says it’s part of their history.','It is new.','Mike needs it.'], a:0},
{k:'ch', q:'Выбери верное предложение:', o:['I check always the alarms.','I always check the alarms.','Always I check the alarms.'], a:1, e:'always — перед обычным глаголом.'},
{k:'ch', q:'Выбери верное предложение:', o:['Mike never is late.','Mike is never late.'], a:1, e:'С be — после глагола: is never.'},
{k:'ch', q:'The router is old. ___ fan is loud.', o:['It’s','Its'], a:1, e:'«It is fan» сказать нельзя — значит its.'},
{k:'ch', q:'___ a new switch.', o:['It’s','Its'], a:0, e:'It’s = It is.'},
{k:'in', q:'I ___ watch TV. (никогда)', a:['never']},
{k:'in', q:'She is ___ calm. (всегда)', a:['always']},
{k:'fx', q:'its a good router.', a:['It’s a good router.','It is a good router.'], e:'Здесь «it is»: It’s. И большая буква в начале.'},
{k:'fx', q:'I don’t never forget my keys.', a:['I never forget my keys.'], e:'never уже отрицание.'},
{k:'dc', a:['Kate is always calm.'], ru:'Кейт всегда спокойна.'},
{k:'tr', ru:'Я обычно встаю в 7.', a:['I usually get up at 7.','I usually get up at seven.','I usually get up at 7 a.m.']},
{k:'tr', ru:'Это старый коммутатор, но он работает.', a:['It’s an old switch, but it works.','It is an old switch, but it works.','This is an old switch, but it works.']},
{k:'tr', ru:'Его вентилятор громкий. (о коммутаторе)', a:['Its fan is loud.']}],
own:'Напиши 5 предложений о своих привычках — по одному на always, usually, often, sometimes, never. Честно, хорошие и плохие.'},

{id:'w2r', w:2, n:6, review:true, t:'Повторение недели: письмо коллеге', g:'всё вместе',
text:[
['Hi Sam,','Привет, Сэм,'],
['Welcome to the team! Here is some information about our work.','Добро пожаловать в команду! Вот немного информации о нашей работе.'],
['We work in shifts. Day shifts start at 8 a.m. and end at 8 p.m.','Мы работаем сменами. Дневные смены начинаются в 8 утра и заканчиваются в 8 вечера.'],
['Night shifts start at 8 p.m. Mike usually works at night.','Ночные смены начинаются в 8 вечера. Ночью обычно работает Майк.'],
['You work two days on, two days off, like me.','Ты работаешь два через два, как и я.'],
['Every morning, the day engineer checks the alarms first.','Каждое утро дневной инженер первым делом проверяет аварии.'],
['Then he or she reads the night notes. Mike writes them at the end of his shift.','Потом он или она читает ночные заметки. Майк пишет их в конце своей смены.'],
['We don’t call users. The support team talks to them.','Мы не звоним пользователям. С ними говорит поддержка.'],
['When a user has no internet, support writes in our chat.','Когда у пользователя нет интернета, поддержка пишет в наш чат.'],
['Please answer in the chat quickly, but don’t panic.','Пожалуйста, отвечай в чате быстро, но не паникуй.'],
['Usually the problem is simple: a cable, a port or a home router.','Обычно проблема простая: кабель, порт или домашний роутер.'],
['Sometimes the problem is big, and many users don’t have internet.','Иногда проблема большая, и интернета нет у многих пользователей.'],
['Then we call Kate. She always knows what to do.','Тогда мы звоним Кейт. Она всегда знает, что делать.'],
['We never change the config without a plan.','Мы никогда не меняем конфигурацию без плана.'],
['Please write notes about every problem. Notes help the next engineer.','Пожалуйста, записывай заметки о каждой проблеме. Они помогают следующему инженеру.'],
['On your days off, rest. Don’t open the work chat!','В выходные отдыхай. Не открывай рабочий чат!'],
['See you on Monday,','Увидимся в понедельник,'],
['Dan','Дэн']],
words:[
['welcome','добро пожаловать'],['information','информация'],['quickly','быстро'],['change','менять'],
['config','конфигурация, конфиг'],['without','без'],['plan','план'],['next','следующий'],['see you','увидимся']],
tasks:[
{k:'ch', q:'When do night shifts start?', o:['at 8 a.m.','at 8 p.m.','at midnight'], a:1},
{k:'ch', q:'What does the day engineer do first?', o:['reads the notes','checks the alarms','calls users'], a:1},
{k:'ch', q:'Who talks to users?', o:['Dan','Mike','the support team'], a:2},
{k:'ch', q:'When do they call Kate?', o:['every morning','when the problem is big','on Mondays'], a:1},
{k:'ch', q:'What does Dan ask Sam to do on his days off?', o:['read the chat','write notes','rest and not open the work chat'], a:2},
{k:'ch', q:'Mike ___ the night notes.', o:['write','writes','is write'], a:1},
{k:'ch', q:'___ Kate know what to do? — Yes, she does.', o:['Do','Does','Is'], a:1},
{k:'ch', q:'We ___ change the config without a plan.', o:['never','don’t never','not'], a:0},
{k:'in', q:'Support ___ call Dan. They write in the chat. (не звонит)', a:['doesn’t','does not','doesnt']},
{k:'fx', q:'mike works at night and he dont call users.', a:['Mike works at night, and he doesn’t call users.','Mike works at night and he doesn’t call users.','Mike works at night and he does not call users.'], e:'Имя — с большой буквы; he → doesn’t.'},
{k:'fx', q:'Its a simple problem, i know what to do.', a:['It’s a simple problem, I know what to do.','It is a simple problem, I know what to do.','It’s a simple problem. I know what to do.'], e:'It’s = it is; I — с большой.'},
{k:'dc', a:['Notes help the next engineer.'], ru:'Заметки помогают следующему инженеру.'},
{k:'tr', ru:'Я обычно проверяю аварии первым делом.', a:['I usually check the alarms first.','Usually I check the alarms first.']},
{k:'tr', ru:'Она не работает ночью.', a:['She doesn’t work at night.']},
{k:'tr', ru:'Во сколько ты встаёшь?', a:['What time do you get up?','When do you get up?']},
{k:'tr', ru:'У нас есть старый коммутатор. Его вентилятор громкий.', a:['We have an old switch. Its fan is loud.','We’ve got an old switch. Its fan is loud.']}],
own:'Главное задание недели. Напиши письмо (8–10 предложений) другу или новому коллеге: как устроен твой рабочий день и твой выходной. Используй всё: I work…, I don’t…, Do you…?, always / usually / never. Этот текст попадёт в отчёт для Claude.'}

];
