import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  BackHandler,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

const { CARDS, getCard, createGame, isCorrectGuess, replaceGuessedCard } = require('./game');

const C = {
  background: '#F6F3ED',
  dark: '#122334',
  text: '#182A39',
  muted: '#657385',
  teal: '#176E68',
  soft: '#E4F3EF',
  white: '#FFFFFF',
  line: '#DCDDD9',
  gold: '#E9BB70',
  red: '#A64B45',
};

function Action({ title, onPress, secondary = false, disabled = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.action,
        secondary ? styles.actionSecondary : styles.actionPrimary,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      <Text style={[styles.actionText, secondary ? styles.actionSecondaryText : styles.actionPrimaryText]}>
        {title}
      </Text>
    </Pressable>
  );
}

function Tile({ card, number, onPress, caption = 'Софизм' }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Открыть карточку ${card.name}`}
      style={({ pressed }) => [styles.tile, pressed && styles.pressed]}
    >
      <Text style={styles.tileEyebrow}>{caption} {String(number).padStart(2, '0')}</Text>
      <Text style={styles.tileTitle}>{card.name}</Text>
      <Text style={styles.tileBody}>{card.short}</Text>
    </Pressable>
  );
}

function SecretFace({ card, explanation }) {
  return (
    <View style={[styles.face, styles.secretFace]}>
      <Text style={styles.faceEyebrow}>ТАЙНАЯ КАРТА СПОРЩИКА</Text>
      <View>
        <Text style={styles.faceTitle}>{card.name}</Text>
        <Text style={styles.faceBody}>
          {explanation ? card.short : 'Запомните название. При необходимости откройте короткое пояснение.'}
        </Text>
      </View>
    </View>
  );
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [disputant, setDisputant] = useState('Сергей');
  const [guesser, setGuesser] = useState('Маша');
  const [game, setGame] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [secretExplanation, setSecretExplanation] = useState(false);
  const [wasCorrect, setWasCorrect] = useState(false);
  const selected = getCard(selectedId);

  const back = useCallback(() => {
    const previous = {
      rules: 'home', setup: 'home', handoff: 'setup', secret: 'handoff',
      catalog: 'home', card: 'catalog', guess: 'card', result: 'catalog',
      read: 'home', article: 'read',
    };
    if (screen === 'home') return false;
    if (screen === 'result') {
      setSecretExplanation(false);
      setScreen(wasCorrect && game?.active ? 'handoff' : 'catalog');
      return true;
    }
    if (screen === 'secret') setSecretExplanation(false);
    setScreen(previous[screen] || 'home');
    return true;
  }, [screen, wasCorrect, game]);

  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', back);
    return () => listener.remove();
  }, [back]);

  function start() {
    setGame(createGame(disputant.trim() || 'Сергей', guesser.trim() || 'Маша'));
    setSelectedId(null);
    setSecretExplanation(false);
    setScreen('handoff');
  }

  function checkGuess() {
    if (!game || !selected) return;
    const correct = isCorrectGuess(game, selected.id);
    setWasCorrect(correct);
    if (correct) setGame(replaceGuessedCard(game));
    setScreen('result');
  }

  function openCatalog() {
    setSecretExplanation(false);
    setScreen('catalog');
  }

  function newGame() {
    if (game && game.active) {
      Alert.alert('Новая игра', 'Текущая партия начнётся заново.', [
        { text: 'Отмена', style: 'cancel' },
        { text: 'Начать заново', onPress: () => setScreen('setup') },
      ]);
    } else {
      setScreen('setup');
    }
  }

  let content = null;

  if (screen === 'home') {
    content = <>
      <View style={styles.hero}>
        <Text style={styles.heroEyebrow}>УВИДЕТЬ ЛОГИКУ СПОРА</Text>
        <Text style={styles.heroTitle}>Мания заблуждений</Text>
        <Text style={styles.heroBody}>Карточки софизмов для живой игры на одном телефоне.</Text>
      </View>
      <Action title="Играть →" onPress={() => setScreen('setup')} />
      <Action title="Читать →" onPress={() => setScreen('read')} secondary />
      <Action title="Правила игры →" onPress={() => setScreen('rules')} secondary />
      <Text style={styles.footnote}>Пробная партия: один спорщик, один отгадчик, четыре софизма.</Text>
    </>;
  } else if (screen === 'rules') {
    content = <>
      <Text style={styles.eyebrow}>КАК ИГРАТЬ</Text>
      <Text style={styles.title}>Найди софизм в споре</Text>
      <Text style={styles.subtitle}>Люди спорят вслух. Приложение выдаёт скрытую карту и проверяет догадку.</Text>
      <View style={styles.panel}>
        <Text style={styles.paragraph}>1. Спорщик тайно смотрит свой софизм и старается использовать его в разговоре.</Text>
        <Text style={styles.paragraph}>2. Отгадчик открывает карточку замеченного им софизма.</Text>
        <Text style={styles.paragraph}>3. Он нажимает «Угадать». Приложение сравнивает выбранную карточку с картой спорщика.</Text>
        <Text style={[styles.paragraph, styles.last]}>4. При верной догадке спорщик получает новую карту.</Text>
      </View>
      <Text style={styles.note}>Приложение проверяет наличие карты у спорщика, а не его произнесённые слова.</Text>
      <Action title="Создать игру" onPress={() => setScreen('setup')} />
    </>;
  } else if (screen === 'setup') {
    content = <>
      <Text style={styles.eyebrow}>НОВАЯ ИГРА · ШАГ 1 ИЗ 2</Text>
      <Text style={styles.title}>Кто играет?</Text>
      <Text style={styles.subtitle}>В этой версии участвуют один спорщик и один отгадчик.</Text>
      <View style={styles.panel}>
        <Text style={styles.label}>Спорщик</Text>
        <TextInput value={disputant} onChangeText={setDisputant} maxLength={32} style={styles.input} autoCorrect={false} accessibilityLabel="Имя спорщика" />
        <Text style={styles.label}>Отгадчик</Text>
        <TextInput value={guesser} onChangeText={setGuesser} maxLength={32} style={styles.input} autoCorrect={false} accessibilityLabel="Имя отгадчика" />
      </View>
      <Text style={styles.callout}>Спорщик получает одну тайную карту. Отгадчик видит все четыре карточки и ищет нужную.</Text>
      <Action title="Начать и выдать карту" onPress={start} />
    </>;
  } else if (screen === 'handoff') {
    content = <>
      <Text style={styles.eyebrow}>ТАЙНАЯ ВЫДАЧА · ШАГ 2 ИЗ 2</Text>
      <Text style={styles.bigSymbol}>↗</Text>
      <Text style={[styles.title, styles.center]}>Передайте телефон игроку {game?.disputant}</Text>
      <Text style={[styles.subtitle, styles.center]}>Его карточку должен видеть только он. Остальные отворачиваются.</Text>
      <Action title={`Я — ${game?.disputant}. Показать карту`} onPress={() => setScreen('secret')} />
    </>;
  } else if (screen === 'secret' && game?.active) {
    content = <>
      <Text style={styles.eyebrow}>ТОЛЬКО ДЛЯ СПОРЩИКА</Text>
      <Text style={styles.title}>Ваша тайная карта</Text>
      <SecretFace card={getCard(game.active)} explanation={secretExplanation} />
      <Action title={secretExplanation ? 'Скрыть пояснение' : 'Показать краткое пояснение'} onPress={() => setSecretExplanation(!secretExplanation)} secondary />
      <Action title="Запомнил. Скрыть карту" onPress={openCatalog} />
    </>;
  } else if (screen === 'catalog') {
    content = <>
      <View style={styles.status}><View style={styles.statusText}>
        <Text style={styles.eyebrow}>ПАРТИЯ ИДЁТ</Text>
        <Text style={styles.statusName}>{game?.guesser} угадывает карту {game?.disputant}</Text>
      </View><Text style={styles.chip}>{game?.active ? '1 тайная карта' : 'Карты закончились'}</Text></View>
      <Text style={styles.title}>Какая уловка звучит?</Text>
      <Text style={styles.subtitle}>Откройте карточку, когда заметите приём в споре.</Text>
      {CARDS.map((card, index) => <Tile key={card.id} card={card} number={index + 1} onPress={() => { setSelectedId(card.id); setScreen('card'); }} />)}
      {!game?.active && <><Text style={styles.note}>Все четыре карты сыграны. Начните новую пробную партию.</Text><Action title="Новая игра" onPress={newGame} /></>}
    </>;
  } else if (screen === 'card' && selected) {
    content = <>
      <Text style={styles.eyebrow}>КАРТОЧКА {CARDS.indexOf(selected) + 1} ИЗ 4</Text>
      <View style={styles.face}><Text style={styles.faceEyebrow}>ИГРОВАЯ КАРТОЧКА</Text><View>
        <Text style={styles.faceTitle}>{selected.name}</Text>
        <Text style={styles.faceBody}>{selected.short}</Text>
      </View></View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Пример в споре</Text><Text style={styles.paragraph}>{selected.example}</Text></View>
      <Text style={styles.subtitle}>Софизм для попытки уже выбран: «{selected.name}».</Text>
      <Action title="Угадать" disabled={!game?.active} onPress={() => setScreen('guess')} />
    </>;
  } else if (screen === 'guess' && selected) {
    content = <>
      <Text style={styles.eyebrow}>ПОПЫТКА УГАДЫВАНИЯ</Text>
      <Text style={styles.title}>Проверим догадку?</Text>
      <Text style={styles.subtitle}>Софизм взят из открытой карточки.</Text>
      <View style={styles.choice}><Text style={styles.choiceLabel}>Софизм</Text><Text style={styles.choiceValue}>{selected.name}</Text></View>
      <View style={styles.choice}><Text style={styles.choiceLabel}>Кто отгадывает</Text><Text style={styles.choiceValue}>{game?.guesser}</Text></View>
      <View style={styles.choice}><Text style={styles.choiceLabel}>Кого отгадывают</Text><Text style={styles.choiceValue}>{game?.disputant}</Text></View>
      <Text style={styles.note}>В этой партии по одному игроку каждой роли, поэтому имена подставлены автоматически.</Text>
      <Action title="Подтвердить попытку" onPress={checkGuess} />
      <Action title="Вернуться к карточке" onPress={() => setScreen('card')} secondary />
    </>;
  } else if (screen === 'result' && selected) {
    content = <>
      <Text style={[styles.bigSymbol, !wasCorrect && styles.badSymbol]}>{wasCorrect ? '✓' : '×'}</Text>
      <Text style={[styles.title, styles.center]}>{wasCorrect ? 'Угадано!' : 'Пока не угадано'}</Text>
      <Text style={[styles.subtitle, styles.center]}>
        {wasCorrect
          ? `У ${game?.disputant} действительно была карта «${selected.name}». ${game?.active ? 'Передайте телефон спорщику для новой карты.' : 'Все четыре карты сыграны.'}`
          : `Карты «${selected.name}» сейчас нет у ${game?.disputant}. Она остаётся в каталоге: попробуйте позже.`}
      </Text>
      <Action
        title={wasCorrect && game?.active ? 'Передать телефон спорщику' : 'Продолжить игру'}
        onPress={() => { setSecretExplanation(false); setScreen(wasCorrect && game?.active ? 'handoff' : 'catalog'); }}
      />
      {wasCorrect && !game?.active && <Text style={styles.note}>Колода исчерпана. Для повтора начните новую игру.</Text>}
    </>;
  } else if (screen === 'read') {
    content = <>
      <Text style={styles.eyebrow}>РАЗДЕЛ «ЧИТАТЬ»</Text>
      <Text style={styles.title}>Четыре софизма</Text>
      <Text style={styles.subtitle}>Короткий учебный каталог для прототипа.</Text>
      {CARDS.map((card, index) => <Tile key={card.id} card={card} number={index + 1} caption="Материал" onPress={() => { setSelectedId(card.id); setScreen('article'); }} />)}
    </>;
  } else if (screen === 'article' && selected) {
    content = <>
      <Text style={styles.eyebrow}>УЧЕБНЫЙ МАТЕРИАЛ</Text>
      <Text style={styles.title}>{selected.name}</Text>
      <View style={styles.panel}><Text style={styles.panelTitle}>В чём приём?</Text><Text style={styles.paragraph}>{selected.short}</Text>
        <View style={styles.divider} /><Text style={styles.panelTitle}>Как это звучит?</Text><Text style={[styles.paragraph, styles.last]}>{selected.example}</Text>
      </View>
      <Action title="Все софизмы" onPress={() => setScreen('read')} secondary />
    </>;
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar barStyle="light-content" backgroundColor={C.dark} />
      <View style={styles.header}>
        {screen !== 'home' ? <Pressable onPress={back} accessibilityRole="button" accessibilityLabel="Назад" style={styles.back}><Text style={styles.backText}>‹</Text></Pressable> : null}
        <Text style={styles.logo}>?</Text><Text style={styles.headerTitle}>МАНИЯ ЗАБЛУЖДЕНИЙ</Text>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content} key={screen}>
        {content}
      </ScrollView>
      <Text style={styles.footer}>Пробная версия · Работает без интернета после установки</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.background },
  header: { minHeight: 62, backgroundColor: C.dark, paddingHorizontal: 19, flexDirection: 'row', alignItems: 'center' },
  logo: { width: 28, height: 28, textAlign: 'center', textAlignVertical: 'center', overflow: 'hidden', borderRadius: 7, backgroundColor: C.gold, color: C.dark, fontWeight: '900', fontSize: 20, marginRight: 10 },
  headerTitle: { color: C.white, fontSize: 14, fontWeight: '800', letterSpacing: 0.6 },
  back: { marginRight: 8, minWidth: 30 }, backText: { color: C.white, fontSize: 30, lineHeight: 33 },
  content: { paddingHorizontal: 22, paddingTop: 26, paddingBottom: 36, flexGrow: 1 },
  footer: { textAlign: 'center', paddingVertical: 12, color: C.muted, fontSize: 11 },
  eyebrow: { color: C.teal, fontSize: 11, fontWeight: '800', letterSpacing: 1.4, marginBottom: 11 },
  title: { color: C.text, fontSize: 30, fontWeight: '800', lineHeight: 34, marginBottom: 13 },
  subtitle: { color: C.muted, fontSize: 15, lineHeight: 22, marginBottom: 19 },
  center: { textAlign: 'center' },
  hero: { backgroundColor: C.dark, borderRadius: 23, padding: 26, marginBottom: 23, minHeight: 235, justifyContent: 'space-between' },
  heroEyebrow: { color: C.gold, fontSize: 11, letterSpacing: 1.3, fontWeight: '800' },
  heroTitle: { color: C.white, fontSize: 35, lineHeight: 38, fontWeight: '800', maxWidth: 280 },
  heroBody: { color: '#C6D5D8', fontSize: 15, lineHeight: 21 },
  action: { minHeight: 55, borderRadius: 14, alignItems: 'center', justifyContent: 'center', padding: 12, marginBottom: 11 },
  actionPrimary: { backgroundColor: C.teal }, actionSecondary: { backgroundColor: '#E6EAE7', borderColor: C.line, borderWidth: 1 },
  actionText: { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  actionPrimaryText: { color: C.white }, actionSecondaryText: { color: C.text },
  pressed: { opacity: 0.8 }, disabled: { opacity: 0.45 },
  footnote: { color: C.muted, fontSize: 12, textAlign: 'center', marginTop: 9 },
  panel: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 17, padding: 18, marginBottom: 18 },
  paragraph: { color: C.text, fontSize: 15, lineHeight: 22, marginBottom: 13 }, last: { marginBottom: 0 },
  panelTitle: { color: C.text, fontSize: 17, fontWeight: '800', marginBottom: 8 },
  note: { backgroundColor: '#F1EDE5', borderLeftWidth: 3, borderLeftColor: C.gold, color: C.muted, fontSize: 13, lineHeight: 19, padding: 13, marginVertical: 16 },
  callout: { color: '#19544F', backgroundColor: C.soft, padding: 16, borderRadius: 15, lineHeight: 21, marginBottom: 22 },
  label: { color: C.text, fontSize: 13, fontWeight: '700', marginBottom: 7 },
  input: { borderWidth: 1, borderColor: '#CAD2D1', color: C.text, fontSize: 16, borderRadius: 11, height: 49, paddingHorizontal: 13, marginBottom: 16 },
  bigSymbol: { color: C.teal, fontSize: 51, fontWeight: '800', textAlign: 'center', marginVertical: 25 }, badSymbol: { color: C.red },
  face: { backgroundColor: C.dark, borderRadius: 22, padding: 25, minHeight: 260, justifyContent: 'space-between', marginVertical: 15 },
  secretFace: { backgroundColor: C.teal }, faceEyebrow: { color: C.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.3 },
  faceTitle: { color: C.white, fontSize: 29, lineHeight: 34, fontWeight: '800', marginBottom: 12 },
  faceBody: { color: '#D0DEDF', fontSize: 15, lineHeight: 21 },
  tile: { backgroundColor: C.white, borderRadius: 16, borderWidth: 1, borderColor: C.line, padding: 17, marginBottom: 11 },
  tileEyebrow: { color: C.muted, fontSize: 12, marginBottom: 5 },
  tileTitle: { color: C.text, fontSize: 18, lineHeight: 23, fontWeight: '800', marginBottom: 6 },
  tileBody: { color: C.muted, fontSize: 13, lineHeight: 18 },
  status: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 }, statusText: { flex: 1, marginRight: 10 }, statusName: { color: C.text, fontSize: 13, fontWeight: '700' },
  chip: { color: C.teal, backgroundColor: C.soft, fontSize: 11, fontWeight: '800', overflow: 'hidden', borderRadius: 15, paddingHorizontal: 9, paddingVertical: 6 },
  choice: { backgroundColor: C.white, borderWidth: 1, borderColor: C.line, borderRadius: 12, padding: 14, marginBottom: 11 },
  choiceLabel: { color: C.muted, fontSize: 12, marginBottom: 5 }, choiceValue: { color: C.text, fontSize: 15, fontWeight: '800' },
  divider: { height: 1, backgroundColor: C.line, marginVertical: 14 },
});
