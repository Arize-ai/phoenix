/**
 * Language detection evaluator benchmark.
 *
 * Classifies the primary language of a session as english, mandarin_chinese,
 * hindi, spanish, french, or other.
 */
import * as px from "@arizeai/phoenix-client/vitest";
import { createLanguageDetectionEvaluator } from "@arizeai/phoenix-evals";
import { afterAll } from "vitest";

import {
  createLabelAccumulator,
  recordPrediction,
  registerAggregateMetricsTest,
} from "./aggregateMetrics.js";
import { accuracy } from "./evaluators.js";
import { evalModel, evalModelName } from "./model.js";

const labels = createLabelAccumulator();

const languageDetectionEvaluator = createLanguageDetectionEvaluator({
  model: evalModel,
});

type LanguageLabel =
  | "english"
  | "mandarin_chinese"
  | "hindi"
  | "spanish"
  | "french"
  | "other";

const examplesByCategory = {
  monolingual: [
    {
      id: "mono_english_support",
      session: `User: My deployment keeps failing with an "out of memory" error during the build step. I've tried increasing the timeout but that didn't help. Any idea what's going on?
Assistant: The build step running out of memory usually means the bundler is trying to hold too much in memory at once. Increasing the timeout won't help because the process is being killed, not timing out. Try lowering the parallelism of the build, or bump the container's memory limit. Which build tool are you using?
User: We're on webpack, and the container has 2 GB allocated.
Assistant: 2 GB is on the low side for a large webpack build. Set the Node heap explicitly and give the container more headroom — 4 GB is a safer baseline for production bundles. If that clears it, the leak was just source maps and vendor chunks piling up.`,
      expected_label: "english" as const,
      notes: "Single language throughout, both parties.",
    },
    {
      id: "mono_spanish_billing",
      session: `User: Hola, tengo una duda con mi factura de este mes. Me cobraron dos veces el mismo servicio y no entiendo por qué.
Assistant: Buenos días. Lamento el inconveniente. Los cobros duplicados suelen deberse a un reintento automático cuando el primer pago queda pendiente. ¿Podría indicarme la fecha exacta de los dos cargos?
User: Sí, ambos aparecen el día 3 de este mes, con el mismo importe de 49,90 euros.
Assistant: Gracias. Confirmo que se trata de un cargo repetido por un reintento fallido. Voy a tramitar la devolución del segundo importe; tardará entre tres y cinco días hábiles en reflejarse en su cuenta.`,
      expected_label: "spanish" as const,
      notes: 'Monolingual Spanish. "euros" is not a foreign-language marker.',
    },
    {
      id: "mono_japanese_recipe",
      session: `User: だしの取り方を教えてください。昆布とかつお節を使う基本的な方法が知りたいです。
Assistant: 基本の一番だしの作り方をご説明します。まず水に昆布を入れて三十分ほど浸してから、弱火にかけます。沸騰する直前に昆布を取り出し、かつお節を加えてひと煮立ちさせてから火を止めます。数分置いてこすと、澄んだだしができます。
User: ありがとうございます。昆布は取り出したあと、もう一度使えますか。
Assistant: はい、二番だしに使えます。取り出した昆布とかつお節をもう一度水から煮出すと、煮物などにちょうど良い、やや薄めのだしが取れます。`,
      expected_label: "other" as const,
      notes: "Kana + kanji, monolingual Japanese.",
    },
    {
      id: "mono_arabic_travel",
      session: `User: مرحبًا، أخطط لرحلة إلى المغرب في شهر مايو. هل الطقس يكون مناسبًا للسفر في تلك الفترة؟
Assistant: أهلًا بك. شهر مايو من أفضل الأوقات لزيارة المغرب؛ الطقس معتدل في المدن الساحلية مثل الرباط والدار البيضاء، ودافئ نسبيًا في مراكش. أنصحك بحمل ملابس خفيفة مع سترة للمساء.
User: وهل تنصحني بزيارة الصحراء في هذا الوقت؟
Assistant: نعم، أواخر مايو مناسب لزيارة الصحراء قبل اشتداد حرارة الصيف، لكن يُفضّل تنظيم الرحلة في الصباح الباكر أو قرب الغروب لتجنّب حرارة منتصف النهار.`,
      expected_label: "other" as const,
      notes: "Right-to-left script, monolingual Arabic.",
    },
    {
      id: "mono_russian_coding",
      session: `User: Подскажите, пожалуйста, почему мой запрос к базе данных работает так медленно. Таблица большая, около десяти миллионов строк, и выборка по дате занимает несколько секунд.
Assistant: Скорее всего, дело в отсутствии индекса по столбцу с датой. Без индекса база вынуждена просматривать все строки целиком. Создайте индекс по этому столбцу, и выборка по диапазону дат станет заметно быстрее.
User: А если я часто фильтрую сразу по дате и по идентификатору пользователя?
Assistant: Тогда имеет смысл составной индекс по обоим столбцам, причём сначала тот, по которому вы фильтруете точным значением, а затем столбец с диапазоном дат. Так база сможет использовать индекс целиком.`,
      expected_label: "other" as const,
      notes: "Cyrillic, monolingual Russian.",
    },
    {
      id: "mono_hindi_health",
      session: `User: मुझे पिछले कुछ दिनों से सिरदर्द हो रहा है और शाम को थकान महसूस होती है। क्या यह पानी की कमी से हो सकता है?
Assistant: जी हाँ, पर्याप्त पानी न पीने से सिरदर्द और थकान दोनों हो सकते हैं। दिन भर में थोड़ा-थोड़ा करके पानी पीते रहें और स्क्रीन के सामने लंबे समय तक बैठने से बचें। अगर तीन-चार दिन में आराम न मिले तो डॉक्टर से मिलना बेहतर होगा।
User: ठीक है, धन्यवाद। मैं पानी की मात्रा बढ़ाकर देखता हूँ।
Assistant: बहुत अच्छा। साथ में नींद पूरी लें, इससे भी काफ़ी फ़र्क पड़ेगा।`,
      expected_label: "hindi" as const,
      notes: "Devanagari, monolingual Hindi.",
    },
    {
      id: "mono_german_contract",
      session: `User: Ich habe eine Frage zu meinem Arbeitsvertrag. Dort steht eine Probezeit von sechs Monaten. Kann mein Arbeitgeber mich in dieser Zeit ohne Angabe von Gründen kündigen?
Assistant: Während der Probezeit gelten verkürzte Kündigungsfristen, in der Regel zwei Wochen. Der Arbeitgeber muss grundsätzlich keinen Kündigungsgrund nennen, solange die Kündigung nicht sittenwidrig oder diskriminierend ist.
User: Und gilt das auch, wenn ich selbst kündigen möchte?
Assistant: Ja, die verkürzte Frist gilt in der Probezeit für beide Seiten. Sie können also ebenfalls mit der kürzeren Frist kündigen, sofern im Vertrag nichts anderes vereinbart ist.`,
      expected_label: "other" as const,
      notes: "Monolingual German.",
    },
    {
      id: "greek_only_philosophy",
      session: `User: Θα ήθελα να καταλάβω καλύτερα τη διαφορά ανάμεσα στη γνώση και στην πεποίθηση. Μπορείς να μου εξηγήσεις με απλά λόγια;
Assistant: Βεβαίως. Με απλά λόγια, πεποίθηση είναι κάτι που θεωρούμε αληθινό, ενώ γνώση είναι μια πεποίθηση που είναι και αληθινή και δικαιολογημένη. Δηλαδή, για να λέμε ότι κάτι το γνωρίζουμε, δεν αρκεί απλώς να το πιστεύουμε· πρέπει να ισχύει και να έχουμε βάσιμους λόγους να το πιστεύουμε.
User: Κατάλαβα. Άρα κάθε γνώση είναι πεποίθηση, αλλά όχι κάθε πεποίθηση είναι γνώση.
Assistant: Ακριβώς. Το είπες πολύ καθαρά.`,
      expected_label: "other" as const,
      notes: "Monolingual Greek — extends script coverage.",
    },
    {
      id: "mono_mandarin_membership",
      session: `User: 我想把会员计划从月付改成年付。请问差价怎么计算，已经付过的这个月还能抵扣吗？
Assistant: 可以。年付价格按十二个月计算后再减去你这个月已经支付的金额，差额会在确认后从原支付方式收取。切换后下个账单日开始按年计费。
User: 明白了。如果我中途想退回月付，已经支付的年费会退吗？
Assistant: 年费按剩余整月比例退回，不满一个月的部分不退。你可以在账户设置里随时改回月付，退款会在五到七个工作日到账。`,
      expected_label: "mandarin_chinese" as const,
      notes: "Monolingual Mandarin in Simplified characters.",
    },
    {
      id: "mono_mandarin_traditional",
      session: `User: 請問如何更改我的訂單配送地址？我已經完成付款，但地址填錯了。
Assistant: 如果訂單尚未出貨，可以在訂單詳情頁直接修改配送地址。已出貨的訂單無法更改地址，需要聯絡客服安排攔截或改寄。
User: 頁面上顯示狀態是「處理中」，這樣還能改嗎？
Assistant: 「處理中」代表尚未交給物流，你現在還可以自行修改。請在今晚八點前完成，超過這個時間就會進入出貨流程。`,
      expected_label: "mandarin_chinese" as const,
      notes: "Monolingual Mandarin written in Traditional characters.",
    },
    {
      id: "mono_cantonese_delivery",
      session: `User: 唔該，我想問下點樣更改送貨地址。我個訂單已經出咗貨，但係地址打錯咗。
Assistant: 如果已經出咗貨，你自己喺頁面改唔到。你要打去客服，俾訂單編號佢哋，睇下仲趕唔趕得切攔截。
User: 咁我而家先發現，會唔會已經送到錯誤地址？
Assistant: 唔一定。你撳個追蹤連結睇下而家去到邊。如果仲未派件，客服多數趕得切改地址。`,
      expected_label: "other" as const,
      notes:
        "Cantonese, not Mandarin. Primary language is outside the five listed languages.",
    },
    {
      id: "mono_french_reservation",
      session: `User: Bonjour, je voudrais modifier la date de ma réservation. Je devais arriver vendredi, mais je ne pourrai venir que samedi soir.
Assistant: Bonjour. Je peux déplacer votre réservation au samedi, sous réserve de disponibilité. La chambre que vous aviez choisie est libre samedi soir. Souhaitez-vous conserver le même type de chambre ?
User: Oui, s'il vous plaît. Et est-ce que le petit-déjeuner reste inclus ?
Assistant: Oui, le petit-déjeuner reste inclus. Je confirme l'arrivée samedi soir et le départ inchangé lundi matin.`,
      expected_label: "french" as const,
      notes: "Monolingual French.",
    },
  ],
  code_switching: [
    {
      id: "codeswitch_spanglish",
      session: `User: Oye, necesito ayuda con un problema. Estoy intentando configurar un proyecto pero me sale un error cuando corro los tests. Me tira "module not found".
Assistant: Vale, ese error casi siempre significa que falta instalar las dependencias. Corriste el paso de instalacion despues de clonar? Prueba borrar la carpeta de módulos y volver a instalar desde cero.
User: Ah, tienes razón, se me olvidó. Ahora dice 'status code: 200-OK', muchas gracias!
Assistant: ¡Perfecto! Me alegro. Si se rompe de nuevo, revisa que estés usando la versión correcta del runtime.`,
      expected_label: "spanish" as const,
      notes:
        "Conversation in Spanish. English appears only as pasted terminal output.",
    },
    {
      id: "codeswitch_hinglish",
      session: `User: मुझे प्रोजेक्ट चलाने में मदद चाहिए। टेस्ट चलाते समय टर्मिनल पर यह आ रहा है: "Error: Cannot find module 'express'".
Assistant: यह अक्सर तब आता है जब निर्भरताएँ इंस्टॉल नहीं हुई हों। प्रोजेक्ट फ़ोल्डर में इंस्टॉल कमांड चलाकर देखो, फिर टेस्ट दोबारा चलाओ।
User: किया। अब यह दिख रहा है: "Tests: 12 passed, 12 total".
Assistant: ठीक है, सब टेस्ट पास हो गए। अगर फिर से वही त्रुटि आए तो लॉक फ़ाइल हटाकर निर्भरताएँ फिर से इंस्टॉल करना।`,
      expected_label: "hindi" as const,
      notes:
        "Conversation in Hindi. English appears only as pasted terminal output.",
    },
    {
      id: "codeswitch_french_english_error",
      session: `User: Bonjour, j'ai un souci avec mon script. Quand je le lance, il s'arrête tout de suite. Le terminal affiche : "Error: connect ECONNREFUSED 127.0.0.1:5432".
Assistant: Bonjour. Ce message indique que le service auquel votre script essaie de se connecter n'est pas démarré, ou qu'il écoute sur un autre port. Vérifiez que le serveur tourne et que le numéro de port correspond à votre configuration.
User: D'accord. Je l'ai relancé et maintenant j'ai : "server listening on port 5432".
Assistant: Parfait. La connexion devrait passer. Si le script s'arrête encore, vérifiez que vous utilisez le même port dans la configuration.`,
      expected_label: "french" as const,
      notes:
        "Conversation in French. English appears only as pasted terminal output.",
    },
    {
      id: "codeswitch_chinese_english_tech",
      session: `User: 我在部署模型，启动后马上退出了。日志里只有这一行："CUDA out of memory. Tried to allocate 2.00 GiB".
Assistant: 这通常是显存不够。可以把批次调小，或者改用半精度再启动一次。你现在的批次大小是多少？
User: 批次是 32。我改成 8 之后日志变成了 "model loaded, ready on cuda:0"。
Assistant: 那就对了。显存够用了。如果之后又出现同样的报错，再把批次降到 4。`,
      expected_label: "mandarin_chinese" as const,
      notes:
        "Conversation in Mandarin. English appears only as pasted log lines.",
    },
  ],
  translation_request: [
    {
      id: "translate_en_to_french",
      session: `User: I'm writing to a hotel in Paris and my French is rusty. Could you translate this for me? "Hello, I would like to confirm my reservation for two nights starting the 14th of June. Could you please let me know if early check-in is possible? Thank you very much for your help."
Assistant: Of course. Here is a polite version you can send: "Bonjour, je souhaiterais confirmer ma réservation pour deux nuits à partir du 14 juin. Pourriez-vous m'indiquer si une arrivée anticipée est possible ? Je vous remercie beaucoup pour votre aide."
User: That's great, thanks. Is "Bonjour" fine for an email, or should it be more formal?
Assistant: "Bonjour" is perfectly appropriate for a hotel email — polite and standard. If you wanted to be extra formal you could write "Madame, Monsieur," but that's not necessary here.`,
      expected_label: "english" as const,
      notes:
        "Framing + discussion in English carries most substance; the translated target is French. English primary.",
    },
    {
      id: "translate_german_to_italian",
      session: `User: Kannst du mir bitte den folgenden Absatz ins Italienische übersetzen? Ich brauche ihn für eine Produktbeschreibung. "Unsere Kaffeemaschine vereint modernes Design mit einfacher Bedienung. Dank des integrierten Mahlwerks genießen Sie jederzeit frisch gemahlenen Kaffee, und die automatische Reinigungsfunktion spart Ihnen Zeit im Alltag."
Assistant: Gern. Hier ist die italienische Übersetzung: "La nostra macchina da caffè unisce un design moderno a una grande facilità d'uso. Grazie al macinacaffè integrato potrete gustare in qualsiasi momento un caffè macinato fresco, e la funzione di pulizia automatica vi farà risparmiare tempo ogni giorno."
User: Danke! Klingt der letzte Satz natürlich auf Italienisch?
Assistant: Ja, der Satz klingt natürlich. "Vi farà risparmiare tempo ogni giorno" ist eine gebräuchliche und flüssige Formulierung im Italienischen.`,
      expected_label: "other" as const,
      notes:
        "Request + meta-discussion in German; Italian is the translated target. German primary.",
    },
  ],
  primary_by_substance: [
    {
      id: "substance_over_turncount_portuguese",
      session: `User: hey
Assistant: Hi! How can I help you today?
User: one sec
Assistant: No problem, take your time.
User: ok thanks
Assistant: Sure.
User: Pronto. Então, deixa eu te explicar a situação com calma. Eu montei uma pequena loja online para vender produtos artesanais, e desde a semana passada os clientes estão reclamando que, na hora de finalizar a compra, o site trava exatamente quando eles clicam no botão de pagamento. Já testei em três navegadores diferentes, limpei o cache, e mesmo assim o problema continua. O mais estranho é que, no meu computador de desenvolvimento, tudo funciona perfeitamente. Desconfio que seja alguma coisa relacionada ao ambiente de produção, talvez uma variável de configuração do gateway de pagamento que não foi definida corretamente no servidor. Você consegue me ajudar a descobrir por onde começar a investigar?
Assistant: Claro. Pelo que você descreve, o fato de funcionar em desenvolvimento e falhar em produção realmente aponta para uma diferença de configuração. Comece verificando as variáveis de ambiente do gateway no servidor de produção e os registros de erro no momento exato do clique.`,
      expected_label: "other" as const,
      notes:
        "Many short English turns, but one long substantive Portuguese turn carries most content. Portuguese primary despite fewer turns.",
    },
    {
      id: "substance_over_turncount_english",
      session: `User: Salut
Assistant: Salut ! Comment puis-je vous aider ?
User: merci
Assistant: Je vous en prie.
User: d'accord
Assistant: Very well. Since you asked me earlier to write the full incident summary in English for your international team, here it is. On Tuesday at approximately 14:00 UTC our primary database cluster experienced a cascading failure that began when a routine schema migration acquired a long-running lock on the orders table. Because the migration was executed during peak traffic, incoming write requests queued behind the lock and rapidly exhausted the connection pool. Downstream services interpreted the resulting timeouts as the database being unavailable and began aggressively retrying, which amplified the load and delayed recovery. The immediate fix was to abort the migration and drain the retry backlog; the longer-term remediation is to run migrations only during low-traffic windows and to add a statement timeout so no single migration can hold a lock indefinitely.
Assistant: That's a clear summary. I'd add one recommendation: gate schema migrations behind a maintenance flag so they can never run automatically during peak hours.`,
      expected_label: "english" as const,
      notes:
        "Short French pleasantries, but the substantive incident write-up is English. English primary.",
    },
  ],
  brief_deliberate: [
    {
      id: "brief_italian_signoff",
      session: `User: I need to prepare a short toast for my colleague's retirement dinner. Can you help me draft something warm but not too long?
Assistant: Absolutely. Here's a draft: "To Maria — thirty years of steady hands, good judgment, and even better coffee runs. You made the hard days lighter and the good days better. We'll miss you more than these few words can say. Congratulations, and enjoy every well-earned moment."
User: That's lovely, thank you. I'll add a personal touch at the end.
Assistant: Perfect — a personal line at the close always lands best. Good luck with the toast!
User: Grazie mille, sei stato davvero gentile e molto paziente con me. Buona serata!`,
      expected_label: "english" as const,
      notes:
        "The final turn is a full, deliberate Italian sentence — counts. English is primary.",
    },
    {
      id: "brief_spanish_proverb_in_korean",
      session: `User: 발표 마무리에 인용할 만한 좋은 문구를 찾고 있어요. 인내와 꾸준함에 관한 것이면 좋겠어요.
Assistant: 스페인어 속담 중에 이런 말이 있습니다: "Poco a poco se anda lejos." 직역하면 "조금씩 가다 보면 멀리 간다"는 뜻으로, 꾸준함의 힘을 잘 담고 있습니다. 발표 마무리에 잘 어울릴 것 같습니다.
User: 좋네요. 그 문구를 슬라이드에 넣고 아래에 한국어 해석을 같이 적어야겠어요.
Assistant: 좋은 생각입니다. 원문과 해석을 함께 보여주면 청중에게 더 인상 깊게 전달될 것입니다.`,
      expected_label: "other" as const,
      notes:
        "Korean session; a genuine Spanish proverb is quoted and discussed — Spanish counts. Korean primary.",
    },
  ],
  loanword_exclusion: [
    {
      id: "loanwords_spanish_tech",
      session: `User: Buenas, no consigo hacer login en la aplicación. Cada vez que meto mi email y mi password, me da un error y no me deja entrar. ¿Puedes ayudarme?
Assistant: Claro. Ese error al hacer login suele deberse a que la sesión anterior no se cerró bien. Prueba a borrar la caché del navegador y a reiniciar la app. Si sigue fallando, puede ser un problema del servidor.
User: Vale, borré la caché y reinicié, pero nada. El software sigue dando el mismo error. La CPU del móvil se pone al cien por cien y luego se cierra.
Assistant: Entendido. Si la CPU se dispara y la app se cierra, parece un bloqueo interno. Vamos a reinstalar la aplicación desde cero para descartar archivos corruptos. Ok, dime cuando lo tengas hecho.`,
      expected_label: "spanish" as const,
      notes:
        "The terms login, email, password, software, CPU, app, Ok are English-origin loanwords/acronyms embedded in Spanish. NOT a second language — Spanish only.",
    },
    {
      id: "loanwords_japanese_katakana",
      session: `User: 新しいノートパソコンを買ったのですが、インターネットにうまく接続できません。Wi-Fiのアイコンは出ているのに、ブラウザでページが開かないんです。
Assistant: なるほど。Wi-Fi には接続できていてもページが開かない場合は、ルーターかDNSの設定が原因のことが多いです。まずはルーターを再起動してみてください。それでも直らなければ、DNSサーバーの設定を確認しましょう。OK ですか？
User: はい、ルーターを再起動したら直りました。ありがとうございます。Google も普通に開けます。
Assistant: よかったです。今後また同じ症状が出たら、まずルーターの再起動を試すと早く解決できますよ。`,
      expected_label: "other" as const,
      notes:
        "Katakana loanwords (ノートパソコン, インターネット, ブラウザ, ルーター), acronyms (Wi-Fi, DNS, OK), brand (Google). All embedded in Japanese — Japanese only.",
    },
  ],
  identifier_exclusion: [
    {
      id: "identifiers_german_react",
      session: `User: Ich baue gerade eine Weboberfläche mit React und komme bei der Zustandsverwaltung nicht weiter. Ich nutze useState für ein Formular, aber bei jedem Tastendruck wird die ganze Komponente neu gerendert und die Eingabe fühlt sich träge an.
Assistant: Das ist ein bekanntes Muster. Wenn die ganze Komponente bei jeder Eingabe neu rendert, lohnt es sich, das Formular in kleinere Komponenten aufzuteilen oder die Eingabefelder mit useRef unkontrolliert zu lassen. Mit welchem Framework deployst du — Docker, oder direkt über GitHub Actions?
User: Über GitHub Actions. Aber das Rendern ist das eigentliche Problem, nicht das Deployment.
Assistant: Verstanden. Dann konzentrieren wir uns auf das Rendern: Lagere die teure Berechnung mit useMemo aus und stelle sicher, dass du nicht bei jedem Tastendruck neue Objekt-Props an Kindkomponenten übergibst.`,
      expected_label: "other" as const,
      notes:
        "The tokens React, useState, useRef, useMemo, Docker, GitHub Actions are library/tool/API identifiers and brand names, not English prose. German only.",
    },
  ],
  code_and_structured_ignored: [
    {
      id: "code_with_english_prose",
      session: `User: Can you review this function? I think it has an off-by-one bug somewhere.
Assistant: |
  You're right — the loop condition should be \`<\`, not \`<=\`, otherwise it reads one element past the end of the array. Here's the corrected version:

  \`\`\`python
  def sum_first_n(values, n):
      # Guard against n larger than the list length
      total = 0
      for i in range(n):  # was range(n + 1), which overran the list
          total += values[i]
      return total
  \`\`\`

  Config used for the failing run:

  \`\`\`json
  {"n": 5, "values": [3, 1, 4, 1, 5], "strict": true}
  \`\`\`
User: Ah, that makes sense. Thanks!`,
      expected_label: "english" as const,
      notes:
        "Python and JSON blocks are ignored; the English prose (and the English comment) is the only natural language. English only.",
    },
  ],
  comment_prose_counts: [
    {
      id: "comment_only_french",
      session: `User: |
  \`\`\`python
  def calculer_moyenne(notes):
      if not notes:
          return 0
      return sum(notes) / len(notes)
  \`\`\`
Assistant: |
  \`\`\`python
  def calculer_moyenne(notes):
      # La liste vide est gérée avant la division pour rester robuste
      return sum(notes) / len(notes) if notes else 0
  \`\`\``,
      expected_label: "french" as const,
      notes:
        "Only natural-language content is the French prose inside the assistant's code comment. Identifiers like calculer_moyenne are code, not prose. French only.",
    },
  ],
  no_natural_language: [
    {
      id: "no_natural_language_code_json",
      session: `User: |
  \`\`\`
  GET /api/v2/orders?status=open&limit=50 HTTP/1.1
  Host: api.example.com
  Authorization: Bearer eyJhbGciOiJIUzI1NiJ9
  \`\`\`
Assistant: |
  \`\`\`
  status=200 duration_ms=37 cache=HIT
  \`\`\``,
      expected_label: "other" as const,
      notes:
        "Only an HTTP request and a status line — no natural-language prose.",
    },
  ],
  uninformative_only: [
    {
      id: "no_natural_language_symbols",
      session: `User: 👍
Assistant: 🙂
User: 42
Assistant: https://example.com/status/12345
User: ✅✅✅`,
      expected_label: "other" as const,
      notes:
        "Emoji, a bare number, a URL — all non-linguistic/uninformative. Nothing should drive a language. Empty + null.",
    },
  ],
  borderline_default_exclude: [
    {
      id: "borderline_english_only",
      session: `User: I'm putting together the agenda for tomorrow's standup. Can you help me tighten the wording so it fits on one slide?
Assistant: Sure. Here's a tighter version: "Standup 9:00 — blockers first, then demos, then planning. Two minutes per person, hard stop at 9:20." Short, scannable, and it sets expectations up front.
User: Great. Add a line that we'll cover the roadmap etc. at the end, and note the venue is the usual room.
Assistant: Done: "Wrap-up (9:15): roadmap and open items. Same room as always." That keeps it on one slide.`,
      expected_label: "english" as const,
      notes:
        "The abbreviation etc. (Latin) and the word venue are naturalized English usage, not a deliberate second language. Borderline -> exclude. English only.",
    },
    {
      id: "borderline_ambiguous_short_in_german",
      session: `User: Ich möchte mein Fahrrad verkaufen und weiß nicht, welchen Preis ich verlangen soll. Es ist drei Jahre alt und gut gepflegt.
Assistant: Bei einem drei Jahre alten, gut gepflegten Fahrrad kannst du in der Regel etwa die Hälfte des Neupreises verlangen. Kennst du noch den ursprünglichen Kaufpreis?
User: No.
Assistant: Kein Problem. Dann orientiere dich an vergleichbaren Angeboten für dasselbe Modell und denselben Zustand; so bekommst du schnell ein realistisches Gefühl für den Marktpreis.`,
      expected_label: "other" as const,
      notes:
        'The one-word "No." is ambiguous (English/interjection) and too short to establish a language. Default exclude. German only.',
    },
  ],
  multilingual_user: [
    {
      id: "polyglot_three_languages",
      session: `User: Hi, I'm preparing a trilingual welcome message for our conference and I want to check each version reads naturally. Let me paste them one at a time. First, the English: "Welcome to the annual summit. We're delighted to have you with us."
Assistant: That reads naturally and warmly in English. It's clear and appropriately formal for a summit opening.
User: Bien. Maintenant la version française : "Bienvenue au sommet annuel. Nous sommes ravis de vous compter parmi nous."
Assistant: La version française est fluide et naturelle. "Nous sommes ravis de vous compter parmi nous" est une formule d'accueil élégante et courante.
User: Perfecto. Y por último la versión en español: "Bienvenidos a la cumbre anual. Estamos encantados de contar con su presencia."
Assistant: La versión en español también suena natural y cordial. "Estamos encantados de contar con su presencia" es una fórmula de bienvenida muy adecuada para un evento formal.`,
      expected_label: "english" as const,
      notes:
        "A genuinely trilingual session with substantive content in each; English opens and slightly leads. All three count.",
    },
  ],
};

const cases = Object.entries(examplesByCategory).flatMap(
  ([category, categoryExamples]) =>
    categoryExamples.map((example) => ({
      input: { session: example.session },
      expected: { label: example.expected_label as LanguageLabel },
      metadata: { category, id: example.id, notes: example.notes },
      splits: [category],
    }))
);

const results: {
  category: string;
  id: string;
  session: string;
  expected: string;
  actual: string | undefined;
  explanation: string | undefined;
}[] = [];

px.describe(
  "language-detection-benchmark",
  () => {
    px.test.each(cases)(
      (row) =>
        `[${String(row.metadata?.category)}] ${String(row.metadata?.id)}`,
      async ({ input, expected, metadata }) => {
        const result = await languageDetectionEvaluator.evaluate({
          session: input.session,
        });
        px.logOutput(result);
        px.logAnnotation({
          name: "language_detection",
          label: result.label,
          explanation: result.explanation,
          annotatorKind: "LLM",
        });
        recordPrediction({
          labels,
          truth: expected?.label,
          predicted: result.label,
        });
        results.push({
          category: String(metadata?.category),
          id: String(metadata?.id),
          session: input.session,
          expected: String(expected?.label),
          actual: result.label,
          explanation: result.explanation,
        });
        await px.evaluate(accuracy);
      }
    );
    registerAggregateMetricsTest(labels);
  },
  {
    description:
      "Language detection across monolingual sessions, code-switching, translation requests, substance-over-turn-count, loanword exclusion, code and structured data, sessions with no natural language, and languages outside the supported set.",
    metadata: { model: evalModelName },
    acceptanceCriteria: [
      { annotationName: "accuracy", metric: "average", threshold: 0.8 },
      { annotationName: "f1", metric: "average", threshold: 0.8 },
    ],
  }
);

afterAll(() => {
  const byCategory = new Map<string, { correct: number; total: number }>();
  for (const result of results) {
    const stats = byCategory.get(result.category) ?? { correct: 0, total: 0 };
    stats.total += 1;
    if (result.actual === result.expected) {
      stats.correct += 1;
    }
    byCategory.set(result.category, stats);
  }
  // eslint-disable-next-line no-console
  console.log("\nlanguage detection benchmark: per-category accuracy");
  for (const [category, stats] of byCategory) {
    // eslint-disable-next-line no-console
    console.log(`  ${category}: ${stats.correct}/${stats.total}`);
  }
  const failures = results.filter(
    (result) => result.actual !== result.expected
  );
  if (failures.length === 0) {
    // eslint-disable-next-line no-console
    console.log("\n✓ language detection benchmark: no misclassified cases\n");
    return;
  }
  // eslint-disable-next-line no-console
  console.log(
    `\n✗ language detection benchmark: ${failures.length} misclassified case(s)`
  );
  for (const failure of failures) {
    const preview = failure.session.replace(/\s+/g, " ").slice(0, 240);
    // eslint-disable-next-line no-console
    console.log(
      `\n[${failure.category}] ${failure.id} expected=${failure.expected} actual=${failure.actual}\n  session: ${preview}\n  judge: ${failure.explanation ?? "(no explanation)"}`
    );
  }
  // eslint-disable-next-line no-console
  console.log("");
});
