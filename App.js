import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, AppState, ImageBackground, KeyboardAvoidingView, Modal, Platform,
  Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text,
  TextInput, View,
} from 'react-native';
const {
  CARDS, getCard, getPlayer, disputants, guessers, activeCount, isGameOver, points,
  createGame, replaceDisputantCard, resolveGuess,
} = require('./game');

// Палитра и формы из голубого варианта Figma (секция «Роман»).
const C = {
  blue: '#274E93', blueDark: '#1B3976', white: '#FFFFFF', ink: '#182A39',
  gray: '#D9D9D9', border: '#CAC4D0', muted: '#596575', purple: '#6750A4',
  purpleDark: '#63469F', lilac: '#F6E5FF', softPurple: '#F8F2FC', tealSoft: '#E4F3EF',
  tealText: '#19544F', danger: '#AC4252', faint: '#F5F5F7', black: '#1D1B20',
};
const { remainingSeconds, formatSeconds: clockText, durationFromParts } = require('./timer');
const DEFAULT_PLAYERS = [
  { id: 'p1', name: 'Сергей', roles: ['disputant'] },
  { id: 'p2', name: 'Маша', roles: ['disputant'] },
  { id: 'p3', name: 'Саша', roles: ['guesser'] },
  { id: 'p4', name: 'Ваня', roles: ['guesser'] },
];
const PLAYER_LIMIT = 8;

function Button({ title, onPress, secondary, disabled, compact, style }) {
  return <Pressable accessibilityRole="button" accessibilityState={{ disabled: !!disabled }}
    disabled={disabled} onPress={onPress} style={({ pressed }) => [
      styles.button, secondary && styles.buttonSecondary, compact && styles.buttonCompact,
      disabled && styles.disabled, pressed && !disabled && styles.pressed, style,
    ]}>
    <Text style={[styles.buttonText, secondary && styles.buttonSecondaryText, compact && styles.buttonCompactText]}>{title}</Text>
  </Pressable>;
}
function SmallButton({ label, onPress, selected, disabled, style }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.smallButton, selected && styles.smallButtonSelected, disabled && styles.disabled,
      pressed && styles.pressed, style]}>
    <Text style={[styles.smallButtonText, selected && styles.smallButtonTextSelected]}>{label}</Text>
  </Pressable>;
}
function Label({ children }) { return <Text style={styles.eyebrow}>{children}</Text>; }
function SectionTitle({ children, center }) {
  return <Text style={[styles.pageTitle, center && styles.center]}>{children}</Text>;
}
function BackHeader({ title, onBack }) {
  return <View style={styles.header}>
    <Pressable accessibilityRole="button" accessibilityLabel="Назад" onPress={onBack} style={styles.backCircle}>
      <Text style={styles.backArrow}>‹</Text>
    </Pressable>
    <View style={styles.headerPill}><Text style={styles.headerTitle}>{title}</Text></View>
  </View>;
}
function CardItem({ card, index, onPress, variant = 'game' }) {
  return <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Открыть ${card.name}`}
    style={({ pressed }) => [styles.cardItem, variant === 'read' && styles.readCard, pressed && styles.pressed]}>
    {variant === 'game' && <Text style={styles.cardNumber}>{String(index + 1).padStart(2, '0')}</Text>}
    <View style={{ flex: 1 }}>
      <Text style={styles.cardItemTitle}>{card.name}</Text>
      <Text style={styles.cardItemBody}>{card.short}</Text>
    </View>
  </Pressable>;
}
function StatsClock({ seconds, active, onPause, onResume, onReset, count }) {
  return <View style={styles.clockWrap}>
    <View style={styles.clockTop}>
      <View>
        <Label>ПАРТИЯ ИДЁТ</Label>
        <Text style={[styles.clockDigits, seconds === 0 && { color: C.danger }]}>{clockText(seconds)}</Text>
      </View>
      <View style={styles.chip}><Text style={styles.chipText}>{count} тайных карт</Text></View>
    </View>
    <View style={styles.clockControls}>
      <SmallButton label={active ? '⏸ Пауза' : '▶ Продолжить'} onPress={active ? onPause : onResume}
        disabled={!seconds} />
      <SmallButton label="↻ Сбросить" onPress={onReset} />
    </View>
  </View>;
}
function ChoiceGroup({ title, people, selected, onPick, disabledIds = [] }) {
  return <View style={styles.choiceGroup}>
    <Text style={styles.choiceTitle}>{title}</Text>
    <View style={styles.choiceChips}>
      {people.map(person => <SmallButton key={person.id} label={person.name}
        disabled={disabledIds.includes(person.id)} selected={person.id === selected}
        onPress={() => onPick(person.id)} style={styles.choiceChip} />)}
    </View>
  </View>;
}
function PromptModal({ visible, title, children, onClose, onConfirm, confirmLabel = 'Добавить' }) {
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalKeyboard}>
        <View style={styles.modalBox}>
          <Text style={styles.modalTitle}>{title}</Text>
          {children}
          <View style={styles.modalActions}>
            <SmallButton label="Отмена" onPress={onClose} />
            <SmallButton label={confirmLabel} selected onPress={onConfirm} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>;
}

export default function App() {
  const [screen, setScreen] = useState('home');
  const [players, setPlayers] = useState(DEFAULT_PLAYERS.map(p => ({ ...p, roles: [...p.roles] })));
  const idCounter = useRef(4);
  const [game, setGame] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [targetId, setTargetId] = useState(null);
  const [guesserId, setGuesserId] = useState(null);
  const [revealQueue, setRevealQueue] = useState([]);
  const [revealDetails, setRevealDetails] = useState(false);
  const [resultInfo, setResultInfo] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newRoles, setNewRoles] = useState(['guesser']);
  const [timeOpen, setTimeOpen] = useState(false);
  const [minutes, setMinutes] = useState('05');
  const [seconds, setSeconds] = useState('00');
  const [duration, setDuration] = useState(300);
  const [timeLeft, setTimeLeft] = useState(300);
  const [timerRunning, setTimerRunning] = useState(false);
  const deadlineRef = useRef(null);
  const alertShownRef = useRef(false);
  const reviewWasRunningRef = useRef(false);
  const selected = getCard(selectedId);
  const awaitingId = revealQueue[0];
  const awaitingPlayer = game && getPlayer(game, awaitingId);
  const awaitingCard = getCard(game?.active?.[awaitingId]);
  const assigned = activeCount(game);

  useEffect(() => {
    if (!timerRunning) return undefined;
    const interval = setInterval(() => {
      const left = remainingSeconds(deadlineRef.current);
      setTimeLeft(left);
      if (left === 0) {
        deadlineRef.current = null;
        setTimerRunning(false);
        if (!alertShownRef.current) {
          alertShownRef.current = true;
          Alert.alert('Время вышло', 'Таймер остановлен. Можно завершить партию или сбросить время.');
        }
      }
    }, 250);
    return () => clearInterval(interval);
  }, [timerRunning]);

  const pauseTimer = useCallback(() => {
    if (deadlineRef.current !== null) {
      setTimeLeft(remainingSeconds(deadlineRef.current));
    }
    deadlineRef.current = null;
    setTimerRunning(false);
  }, []);
  const resumeTimer = useCallback(() => {
    if (timeLeft <= 0) return;
    deadlineRef.current = Date.now() + timeLeft * 1000;
    setTimerRunning(true);
  }, [timeLeft]);
  const resetTimer = useCallback(() => {
    deadlineRef.current = null;
    setTimerRunning(false);
    setTimeLeft(game?.durationSeconds || duration);
    alertShownRef.current = false;
  }, [game, duration]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', state => {
      if (state !== 'active' && deadlineRef.current !== null) pauseTimer();
    });
    return () => listener.remove();
  }, [pauseTimer]);

  const continueAfterResult = useCallback(() => {
    if (resultInfo?.finished || isGameOver(game)) {
      pauseTimer();
      setScreen('end');
    } else if (resultInfo?.hasNewCard) {
      setRevealQueue([resultInfo.disputantId]);
      setRevealDetails(false);
      setScreen('handoff');
    } else {
      setScreen('catalog');
    }
  }, [resultInfo, game, pauseTimer]);

  const back = useCallback(() => {
    const parents = {
      rules: 'home', setup: 'home', handoff: 'catalog', secret: 'handoff',
      catalog: 'home', card: 'catalog', guess: 'card', read: 'home', article: 'read',
      review: 'catalog', end: 'home',
    };
    if (screen === 'home') return false;
    if (screen === 'result') { continueAfterResult(); return true; }
    if (screen === 'secret') setRevealDetails(false);
    if (screen === 'catalog') pauseTimer();
    if (screen === 'handoff' && revealQueue.length) {
      Alert.alert('Тайная выдача', 'Сначала передайте телефон спорщику и скройте его карту.');
      return true;
    }
    setScreen(parents[screen] || 'home');
    return true;
  }, [screen, continueAfterResult, revealQueue, pauseTimer]);
  useEffect(() => {
    const subscription = BackHandlerCompat(back);
    return () => subscription.remove();
  }, [back]);

  function confirmNewGame() {
    const action = () => { pauseTimer(); setResultInfo(null); setRevealQueue([]); setScreen('setup'); };
    if (game && !isGameOver(game)) {
      Alert.alert('Новая игра', 'Текущая партия будет потеряна.', [
        { text: 'Отмена', style: 'cancel' }, { text: 'Начать новую', onPress: action },
      ]);
    } else action();
  }
  function goPlay() {
    if (game && !isGameOver(game)) {
      if (revealQueue.length) setScreen('handoff');
      else { setScreen('catalog'); if (timeLeft > 0) resumeTimer(); }
    } else confirmNewGame();
  }
  function updatePlayer(id, patch) {
    setPlayers(current => current.map(p => p.id === id ? { ...p, ...patch } : p));
  }
  function removePlayer(id) {
    if (players.length <= 2) { Alert.alert('Нужно минимум два игрока'); return; }
    setPlayers(current => current.filter(p => p.id !== id));
  }
  function toggleRole(role) {
    setNewRoles(current => current.includes(role) ? (current.length === 1 ? current : current.filter(x => x !== role)) : [...current, role]);
  }
  function addPlayer(name, roles) {
    if (players.length >= PLAYER_LIMIT) { Alert.alert('Достигнут предел', `Не более ${PLAYER_LIMIT} участников в этой версии.`); return false; }
    const nextName = (name || '').trim();
    if (!nextName) { Alert.alert('Укажите имя'); return false; }
    if (players.some(p => p.name.toLocaleLowerCase('ru') === nextName.toLocaleLowerCase('ru'))) {
      Alert.alert('Имя уже занято', 'Для выбора игроков используйте разные имена.'); return false;
    }
    idCounter.current += 1;
    setPlayers(current => [...current, { id: `p${idCounter.current}`, name: nextName, roles }]);
    return true;
  }
  function saveTime() {
    const value = durationFromParts(minutes, seconds);
    if (value === null) {
      Alert.alert('Неверное время', 'Введите от 00:01 до 99:59.'); return;
    }
    setDuration(value);
    setTimeLeft(value);
    setTimeOpen(false);
  }
  function startGame() {
    try {
      const created = createGame(players, duration);
      setGame(created);
      setRevealQueue(disputants(created).map(p => p.id));
      setSelectedId(null);
      setTargetId(null);
      setGuesserId(null);
      setRevealDetails(false);
      setResultInfo(null);
      deadlineRef.current = null;
      setTimerRunning(false);
      setTimeLeft(duration);
      alertShownRef.current = false;
      setScreen('handoff');
    } catch (error) { Alert.alert('Не удалось начать', error.message); }
  }
  function finishSecret() {
    const remaining = revealQueue.slice(1);
    setRevealQueue(remaining);
    setRevealDetails(false);
    if (remaining.length) setScreen('handoff');
    else if (isGameOver(game)) setScreen('end');
    else {
      setScreen('catalog');
      if (timeLeft > 0) resumeTimer();
    }
  }
  function replaceSecret() {
    Alert.alert('Заменить софизм?', 'Текущая карта будет исключена до конца партии.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Заменить', onPress: () => {
        const next = replaceDisputantCard(game, awaitingId);
        setGame(next);
        setRevealDetails(false);
        if (!next.active[awaitingId]) Alert.alert('Колода исчерпана', 'Новых карт пока нет.');
      } },
    ]);
  }
  function beginGuess(card) {
    setSelectedId(card.id);
    setTargetId(disputants(game).find(p => !!game?.active[p.id])?.id || null);
    setGuesserId(guessers(game)[0]?.id || null);
    setScreen('card');
  }
  function submitGuess() {
    try {
      const outcome = resolveGuess(game, { cardId: selectedId, disputantId: targetId, guesserId });
      setGame(outcome.game);
      setResultInfo({ ...outcome, disputantId: targetId, cardId: selectedId, guesserId });
      if (outcome.correct) pauseTimer();
      setScreen('result');
    } catch (error) { Alert.alert('Проверка невозможна', error.message); }
  }
  function showReview() {
    reviewWasRunningRef.current = timerRunning;
    Alert.alert('Показать тайные карты?', 'На экране будут видны все выданные софизмы. Это может раскрыть секреты спорщиков.', [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Показать', onPress: () => { pauseTimer(); setScreen('review'); } },
    ]);
  }
  const gameHeader = screen !== 'home' && screen !== 'rules' && screen !== 'read' && screen !== 'article';
  const headerTitle = gameHeader ? 'Новая Игра' : screen === 'rules' ? 'ПРАВИЛА' : screen === 'read' ? 'БИБЛИОТЕКА' : selected?.name || 'ЛОЖНАЯ ДИЛЕММА';
  let content = null;
  let bottom = null;

  if (screen === 'home') {
    content = <ImageBackground source={require('./assets/sky-clouds.png')} resizeMode="cover" style={styles.homeBackground}>
      <View style={styles.homeCenter}>
        <View style={styles.homeLogoPanel}><Text style={styles.homeTitle}>МАНИЯ{'\n'}ЗАБЛУЖДЕНИЙ</Text></View>
      </View>
      <View style={styles.homeButtons}>
        <Button title="Играть" onPress={goPlay} />
        <Button title="Библиотека софизмов" secondary onPress={() => setScreen('read')} />
        <Button title="Правила игры" secondary onPress={() => setScreen('rules')} />
      </View>
      <View style={{ flex: 1 }} />
    </ImageBackground>;
  } else if (screen === 'rules') {
    content = <>
      <Label>КАК ИГРАТЬ</Label><SectionTitle>Найди софизм в споре</SectionTitle>
      <Text style={styles.subtitle}>Люди спорят вслух. Приложение выдаёт скрытую карту и проверяет догадку.</Text>
      <View style={styles.panel}>
        <Text style={styles.paragraph}>1. Спорщик тайно смотрит свой софизм и старается использовать его в разговоре.</Text>
        <Text style={styles.paragraph}>2. Отгадчик открывает карточку замеченного им софизма.</Text>
        <Text style={styles.paragraph}>3. Он нажимает «Угадать». Приложение сравнивает выбранную карточку с картой спорщика.</Text>
        <Text style={styles.paragraph}>4. При верной догадке спорщик получает новую карту.</Text>
      </View>
      <View style={styles.note}><Text style={styles.noteText}>Приложение проверяет карты, но не распознаёт произнесённые слова.</Text></View>
    </>;
    bottom = <Button title="Начать игру" onPress={confirmNewGame} />;
  } else if (screen === 'setup') {
    const spyCount = players.filter(p => p.roles.includes('disputant')).length;
    content = <>
      <Label>НОВАЯ ИГРА — ШАГ 1 ИЗ 2</Label><SectionTitle>Кто играет?</SectionTitle>
      <View style={styles.panel}>
        {players.map((person, index) => <View key={person.id} style={styles.playerRow}>
          <View style={styles.playerField}>
            <Text style={styles.fieldCaption}>{person.roles.length === 2 ? 'Обе роли' : person.roles.includes('disputant') ? 'Спорщик' : 'Отгадчик'}</Text>
            <TextInput style={styles.playerInput} value={person.name} maxLength={32} autoCorrect={false}
              accessibilityLabel={`Имя игрока ${index + 1}`}
              onChangeText={name => updatePlayer(person.id, { name })} />
          </View>
          <Pressable onPress={() => removePlayer(person.id)} accessibilityRole="button" accessibilityLabel={`Убрать игрока ${person.name}`} style={styles.deletePlayer}><Text style={styles.deleteText}>⊗</Text></Pressable>
          <View style={styles.roleButtons}>
            <SmallButton label="Спорщик" selected={person.roles.includes('disputant')} onPress={() => {
              const roles = person.roles.includes('disputant') ? person.roles.filter(x => x !== 'disputant') : [...person.roles, 'disputant'];
              if (roles.length) updatePlayer(person.id, { roles });
            }} />
            <SmallButton label="Отгадчик" selected={person.roles.includes('guesser')} onPress={() => {
              const roles = person.roles.includes('guesser') ? person.roles.filter(x => x !== 'guesser') : [...person.roles, 'guesser'];
              if (roles.length) updatePlayer(person.id, { roles });
            }} />
          </View>
        </View>)}
        <View style={styles.addRow}><SmallButton label="+ Добавить игрока" selected onPress={() => { setNewName(''); setNewRoles(['guesser']); setAddOpen(true); }} disabled={players.length >= PLAYER_LIMIT} /></View>
      </View>
      <View style={styles.note}><Text style={styles.noteText}>Спорщик получает тайную карту. Отгадчик видит каталог софизмов и ищет нужную.</Text></View>
      <Pressable style={styles.timeRow} onPress={() => { setMinutes(String(Math.floor(duration / 60)).padStart(2, '0')); setSeconds(String(duration % 60).padStart(2, '0')); setTimeOpen(true); }} accessibilityRole="button" accessibilityLabel="Настроить длительность таймера">
        <Text style={styles.timeLabel}>Время:</Text><View style={styles.timeValue}><Text style={styles.timeValueText}>{clockText(duration)}</Text></View>
      </Pressable>
      <View style={styles.playerCountRow}>
        <Text style={styles.playerCountLabel}>Количество игроков</Text>
        <SmallButton label="−" onPress={() => players.length > 2 && removePlayer(players[players.length - 1].id)} disabled={players.length <= 2} />
        <Text style={styles.countNumber}>{players.length}</Text>
        <SmallButton label="+" onPress={() => addPlayer(`Игрок ${idCounter.current + 1}`, ['guesser'])} disabled={players.length >= PLAYER_LIMIT} />
      </View>
      {spyCount > CARDS.length && <Text style={styles.errorText}>В пробной версии не более четырёх спорщиков.</Text>}
    </>;
    bottom = <Button title="Начать и выдать карту" onPress={startGame} />;
  } else if (screen === 'handoff') {
    content = <>
      <Label>ТАЙНАЯ ВЫДАЧА — ШАГ 2 ИЗ 2</Label>
      <Text style={styles.handoffArrow}>⟶</Text>
      <SectionTitle center>Передайте телефон игроку {awaitingPlayer?.name || 'спорщик'}</SectionTitle>
      <Text style={[styles.subtitle, styles.center]}>Его карточку должен видеть только он. Остальные отворачиваются.</Text>
    </>;
    bottom = <Button title={`Я ${awaitingPlayer?.name || 'спорщик'}`} onPress={() => { setRevealDetails(false); setScreen('secret'); }} />;
  } else if (screen === 'secret') {
    content = <>
      <Label>ТОЛЬКО ДЛЯ СПОРЩИКА</Label><SectionTitle>Ваша тайная карта</SectionTitle>
      {awaitingCard ? <Pressable onPress={() => setRevealDetails(v => !v)} accessibilityRole="button" accessibilityLabel="Показать или скрыть описание софизма" style={styles.secretCard}>
        <Text style={styles.secretTitle}>{awaitingCard.name}</Text>
        <Text style={styles.secretDesc}>{revealDetails ? awaitingCard.short : 'Запомните название. Нажмите на карту, чтобы открыть описание.'}</Text>
      </Pressable> : <View style={styles.panel}><Text style={styles.paragraph}>Карты для этого игрока закончились.</Text></View>}
    </>;
    bottom = <>
      <Button title="Заменить карту" onPress={replaceSecret} secondary disabled={!awaitingCard} />
      <Button title={revealDetails ? 'Запомнил. Скрыть карту' : 'Скрыть карту'} onPress={finishSecret} />
    </>;
  } else if (screen === 'catalog') {
    content = <>
      <StatsClock seconds={timeLeft} active={timerRunning} count={assigned} onPause={pauseTimer} onResume={resumeTimer} onReset={resetTimer} />
      <SectionTitle>Какой софизм звучит?</SectionTitle>
      <Text style={styles.subtitle}>Откройте карточку, когда заметите приём в споре.</Text>
      {CARDS.map((card, i) => <CardItem key={card.id} card={card} index={i} onPress={() => beginGuess(card)} />)}
      <SmallButton label="Посмотреть выданные карты" onPress={showReview} />
      <View style={{ marginTop: 12 }}><SmallButton label="Новая игра" onPress={confirmNewGame} /></View>
      {isGameOver(game) && <Button title="Результаты партии" onPress={() => { pauseTimer(); setScreen('end'); }} />}
    </>;
  } else if (screen === 'card' && selected) {
    content = <>
      <StatsClock seconds={timeLeft} active={timerRunning} count={assigned} onPause={pauseTimer} onResume={resumeTimer} onReset={resetTimer} />
      <View style={styles.secretCard}><Text style={styles.secretTitle}>{selected.name}</Text><Text style={styles.secretDesc}>{selected.short}</Text></View>
      <View style={styles.panel}><Text style={styles.panelTitle}>Пример в споре</Text><Text style={styles.paragraph}>{selected.example}</Text></View>
      <Text style={styles.subtitle}>Софизм для попытки уже выбран: «{selected.name}».</Text>
    </>;
    bottom = <Button title="Угадать" disabled={isGameOver(game)} onPress={() => setScreen('guess')} />;
  } else if (screen === 'guess' && selected) {
    content = <>
      <StatsClock seconds={timeLeft} active={timerRunning} count={assigned} onPause={pauseTimer} onResume={resumeTimer} onReset={resetTimer} />
      <SectionTitle>Проверим догадку?</SectionTitle>
      <Text style={styles.subtitle}>Софизм взят из открытой карточки.</Text>
      <View style={styles.choiceGroup}><Text style={styles.choiceTitle}>Софизм</Text><Text style={styles.choiceValue}>{selected.name}</Text></View>
      <View style={styles.panel}>
        <ChoiceGroup title="Отгадчик" people={guessers(game)} selected={guesserId} onPick={setGuesserId} />
        <ChoiceGroup title="Спорщик" people={disputants(game)} selected={targetId} onPick={setTargetId}
          disabledIds={disputants(game).filter(p => !game.active[p.id]).map(p => p.id)} />
      </View>
    </>;
    bottom = <><Button title="Вернуться к софизмам" secondary onPress={() => setScreen('catalog')} />
      <Button title="Подтвердить попытку" onPress={submitGuess} disabled={!guesserId || !targetId || !game?.active[targetId]} /></>;
  } else if (screen === 'result') {
    const succeeded = resultInfo?.correct;
    const person = getPlayer(game, resultInfo?.disputantId);
    const card = getCard(resultInfo?.cardId);
    content = <View style={styles.resultWrap}>
      <SectionTitle center>{succeeded ? 'Угадано!' : 'Пока не угадано'}</SectionTitle>
      <Text style={[styles.resultSymbol, !succeeded && { color: C.danger }]}>{succeeded ? '✓' : '⊗'}</Text>
      <Text style={[styles.subtitle, styles.center]}>{succeeded
        ? `У ${person?.name} действительно была карта «${card?.name}». ${resultInfo?.hasNewCard ? 'Передайте телефон спорщику для новой карты.' : 'Новых карт для этого спорщика нет.'}`
        : `Карты «${card?.name}» сейчас нет у ${person?.name}. Она остаётся в каталоге: попробуйте позже.`}</Text>
    </View>;
    bottom = <Button title={succeeded && resultInfo?.hasNewCard ? 'Передать телефон спорщику' : (resultInfo?.finished ? 'Результаты партии' : 'Продолжить игру')} onPress={continueAfterResult} />;
  } else if (screen === 'end') {
    const stats = game?.stats || {};
    content = <>
      <Label>ПАРТИЯ ЗАКОНЧИЛАСЬ</Label><Text style={styles.endDate}>{game ? new Date(game.startedAt).toLocaleDateString('ru-RU') : ''}</Text>
      <SectionTitle>Все софизмы отгаданы</SectionTitle>
      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Отгадчики</Text>
        <View style={styles.scoreHead}><Text style={styles.scoreName}>Игрок</Text><Text style={styles.scoreNumber}>Верно</Text><Text style={styles.scoreNumber}>Ошибок</Text><Text style={styles.scoreNumber}>Очки</Text></View>
        {game && guessers(game).map(p => <View key={p.id} style={styles.scoreRow}>
          <Text style={styles.scoreName}>{p.name}</Text><Text style={styles.scoreNumber}>{stats[p.id]?.right}</Text>
          <Text style={styles.scoreNumber}>{stats[p.id]?.wrong}</Text><Text style={styles.scoreNumber}>{points(stats[p.id])}</Text>
        </View>)}
        <View style={styles.separator} />
        <Text style={styles.panelTitle}>Спорщики</Text>
        <View style={styles.scoreHead}><Text style={styles.scoreName}>Игрок</Text><Text style={styles.scoreNumber}>Угадано</Text><Text style={styles.scoreNumber}>Ошибок</Text></View>
        {game && disputants(game).map(p => <View key={p.id} style={styles.scoreRow}>
          <Text style={styles.scoreName}>{p.name}</Text><Text style={styles.scoreNumber}>{stats[p.id]?.solved}</Text>
          <Text style={styles.scoreNumber}>{stats[p.id]?.missed}</Text>
        </View>)}
      </View>
      <Text style={styles.subtitle}>В демонстрационной колоде {CARDS.length} софизма. Чтобы сыграть снова, начните новую партию.</Text>
    </>;
    bottom = <><Button title="В меню" secondary onPress={() => { pauseTimer(); setScreen('home'); }} /><Button title="Новая игра" onPress={confirmNewGame} /></>;
  } else if (screen === 'review') {
    content = <>
      <Label>КАРТЫ СПОРЩИКОВ</Label><SectionTitle>Выданные карты</SectionTitle>
      <Text style={styles.subtitle}>Скрытая информация. Показывайте только ведущему или после окончания раунда.</Text>
      {game && disputants(game).map(p => <View style={styles.choiceGroup} key={p.id}>
        <Text style={styles.choiceTitle}>{p.name}</Text>
        <Text style={styles.choiceValue}>{getCard(game.active[p.id])?.name || 'Нет активной карты'}</Text>
      </View>)}
    </>;
    bottom = <Button title="Скрыть карты и продолжить" onPress={() => { setScreen('catalog'); if (reviewWasRunningRef.current) resumeTimer(); }} />;
  } else if (screen === 'read') {
    content = <>
      <Label>РАЗДЕЛ «ЧИТАТЬ»</Label><SectionTitle>Софизмы</SectionTitle>
      <Text style={styles.subtitle}>Короткий учебный каталог для прототипа.</Text>
      {CARDS.map((card, i) => <CardItem key={card.id} card={card} index={i} variant="read" onPress={() => { setSelectedId(card.id); setScreen('article'); }} />)}
    </>;
  } else if (screen === 'article' && selected) {
    content = <>
      <Label>УЧЕБНЫЙ МАТЕРИАЛ</Label><SectionTitle>{selected.name}</SectionTitle>
      <View style={styles.panel}><Text style={styles.panelTitle}>В чём приём?</Text><Text style={styles.paragraph}>{selected.short}</Text>
        <Text style={styles.panelTitle}>Как это звучит?</Text><Text style={styles.paragraph}>{selected.example}</Text></View>
    </>;
  }

  return <SafeAreaView style={styles.safe}>
    <StatusBar backgroundColor={screen === 'home' ? C.blueDark : C.white} barStyle={screen === 'home' ? 'light-content' : 'dark-content'} />
    {screen === 'home' ? content : <>
      <BackHeader title={headerTitle} onBack={back} />
      <ScrollView key={screen} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        {content}
      </ScrollView>
      {bottom && <View style={styles.bottom}>{bottom}</View>}
    </>}
    <View style={styles.systemNav}><View style={styles.systemNavLine} /></View>
    <PromptModal visible={addOpen} title="Добавить игрока" onClose={() => setAddOpen(false)} onConfirm={() => {
      if (addPlayer(newName, newRoles)) setAddOpen(false);
    }}>
      <TextInput style={styles.modalInput} placeholder="Имя игрока..." placeholderTextColor={C.muted}
        value={newName} onChangeText={setNewName} maxLength={32} autoFocus={false} />
      <Text style={styles.fieldCaption}>Роль игрока (можно выбрать обе)</Text>
      <View style={styles.modalChoiceRow}>
        <SmallButton label="Спорщик" selected={newRoles.includes('disputant')} onPress={() => toggleRole('disputant')} />
        <SmallButton label="Отгадчик" selected={newRoles.includes('guesser')} onPress={() => toggleRole('guesser')} />
      </View>
    </PromptModal>
    <PromptModal visible={timeOpen} title="Время раунда" onClose={() => setTimeOpen(false)} onConfirm={saveTime} confirmLabel="ОК">
      <View style={styles.pickerFields}>
        <View style={styles.pickerUnit}><TextInput value={minutes} onChangeText={t => setMinutes(t.replace(/\D/g, '').slice(0, 2))}
          style={styles.pickerInput} keyboardType="number-pad" maxLength={2} selectTextOnFocus accessibilityLabel="Минуты" />
          <Text style={styles.pickerCaption}>Минуты</Text></View>
        <Text style={styles.pickerColon}>:</Text>
        <View style={styles.pickerUnit}><TextInput value={seconds} onChangeText={t => setSeconds(t.replace(/\D/g, '').slice(0, 2))}
          style={styles.pickerInput} keyboardType="number-pad" maxLength={2} selectTextOnFocus accessibilityLabel="Секунды" />
          <Text style={styles.pickerCaption}>Секунды</Text></View>
      </View>
    </PromptModal>
  </SafeAreaView>;
}

// Подписка находится в функции, чтобы вся логика кнопки Android «Назад»
// имела один обработчик даже в модальных состояниях.
function BackHandlerCompat(onBack) {
  return require('react-native').BackHandler.addEventListener('hardwareBackPress', onBack);
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.white },
  systemNav: { height: 16, backgroundColor: C.white, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 3 },
  systemNavLine: { width: 108, height: 4, backgroundColor: C.black, borderRadius: 10 },
  header: { height: 67, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 19, gap: 10 },
  backCircle: { width: 50, height: 50, backgroundColor: C.gray, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
  backArrow: { color: C.black, fontSize: 46, lineHeight: 50, marginTop: -11 },
  headerPill: { width: 254, maxWidth: '77%', height: 50, backgroundColor: C.gray, borderRadius: 32, justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: C.black, fontFamily: 'serif', fontSize: 17, fontWeight: '900', textAlign: 'center' },
  content: { paddingHorizontal: 24, paddingTop: 28, paddingBottom: 40, flexGrow: 1 },
  bottom: { paddingHorizontal: 24, paddingBottom: 11, paddingTop: 12, backgroundColor: C.white },
  eyebrow: { color: C.purple, fontSize: 11, lineHeight: 18, fontWeight: '900', letterSpacing: 0.55, marginBottom: 22 },
  pageTitle: { color: C.ink, fontSize: 30, fontWeight: '900', lineHeight: 36, marginBottom: 17 },
  subtitle: { color: C.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  center: { textAlign: 'center' },
  button: { minHeight: 55, backgroundColor: C.blue, borderRadius: 32, alignItems: 'center', justifyContent: 'center', marginBottom: 11, paddingVertical: 8, paddingHorizontal: 12 },
  buttonSecondary: { backgroundColor: C.gray, borderColor: '#625B71', borderWidth: 1 },
  buttonCompact: { minHeight: 44 },
  buttonText: { color: C.white, fontSize: 20, textAlign: 'center', fontWeight: '400' },
  buttonSecondaryText: { color: C.black }, buttonCompactText: { fontSize: 16 },
  disabled: { opacity: 0.42 }, pressed: { opacity: 0.7 },
  homeBackground: { flex: 1, width: '100%', backgroundColor: '#DDE9FA' },
  homeCenter: { height: '51%', alignItems: 'center', justifyContent: 'center' },
  homeLogoPanel: { minHeight: 275, width: '73%', borderRadius: 38, backgroundColor: 'rgba(231,239,248,0.65)', justifyContent: 'center', alignItems: 'center', padding: 10 },
  homeTitle: { color: '#111111', fontFamily: 'serif', fontSize: 31, textAlign: 'center', lineHeight: 38 },
  homeButtons: { paddingHorizontal: 33, marginTop: 8 },
  panel: { backgroundColor: C.white, borderColor: '#DCDDD9', borderWidth: 1, borderRadius: 17, padding: 18, marginBottom: 22 },
  paragraph: { color: C.ink, fontSize: 15, lineHeight: 22, marginBottom: 16 },
  panelTitle: { color: C.ink, fontSize: 17, fontWeight: '800', marginBottom: 12 },
  note: { backgroundColor: C.tealSoft, borderRadius: 15, padding: 16, marginBottom: 21 },
  noteText: { color: C.tealText, fontSize: 15, lineHeight: 21 },
  playerRow: { backgroundColor: C.white, marginBottom: 10, paddingBottom: 6, borderBottomColor: '#EBE7EE', borderBottomWidth: 1 },
  playerField: { backgroundColor: '#E6E0E9', borderRadius: 5, minHeight: 53, paddingHorizontal: 15, paddingTop: 7, paddingBottom: 5, paddingRight: 48 },
  fieldCaption: { color: '#49454F', fontSize: 12, marginBottom: 4 },
  playerInput: { color: C.black, fontSize: 16, minHeight: 25, padding: 0 },
  deletePlayer: { position: 'absolute', right: 8, top: 7, width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  deleteText: { fontSize: 25, color: '#484351' },
  roleButtons: { flexDirection: 'row', gap: 8, marginTop: 8 },
  addRow: { flexDirection: 'row', justifyContent: 'flex-end', paddingTop: 4 },
  timeRow: { backgroundColor: '#E6E0E9', borderRadius: 12, minHeight: 65, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 12, marginBottom: 22 },
  timeLabel: { color: C.black, fontSize: 22 },
  timeValue: { minHeight: 65, minWidth: '58%', backgroundColor: C.lilac, borderWidth: 1, borderColor: '#625B71', borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  timeValueText: { fontSize: 24, color: C.black },
  playerCountRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 5 },
  playerCountLabel: { flex: 1, color: C.black, fontWeight: '800', fontSize: 15 },
  countNumber: { backgroundColor: C.lilac, minWidth: 38, minHeight: 44, textAlign: 'center', textAlignVertical: 'center', fontSize: 18, color: C.black, overflow: 'hidden', borderRadius: 4 },
  smallButton: { borderRadius: 9, minHeight: 36, minWidth: 42, backgroundColor: C.gray, paddingHorizontal: 12, paddingVertical: 6, justifyContent: 'center', alignItems: 'center' },
  smallButtonSelected: { backgroundColor: C.lilac, borderColor: C.purple, borderWidth: 1 },
  smallButtonText: { fontSize: 13, color: C.black, textAlign: 'center' },
  smallButtonTextSelected: { color: C.purple, fontWeight: '800' },
  errorText: { color: C.danger, marginVertical: 10 },
  handoffArrow: { color: C.black, fontSize: 90, textAlign: 'center', marginVertical: 16 },
  secretCard: { backgroundColor: C.purpleDark, borderRadius: 17, padding: 23, minHeight: 260, justifyContent: 'flex-start', marginBottom: 20 },
  secretTitle: { color: C.white, fontSize: 25, fontWeight: '900', lineHeight: 30, marginBottom: 12 },
  secretDesc: { color: C.white, fontSize: 14, lineHeight: 20 },
  clockWrap: { marginBottom: 17 },
  clockTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  clockDigits: { fontSize: 32, fontWeight: '900', color: C.purple, marginTop: -15 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, backgroundColor: C.tealSoft, borderRadius: 15 },
  chipText: { color: C.tealText, fontSize: 12 },
  clockControls: { flexDirection: 'row', gap: 8, marginTop: 9, marginBottom: 4 },
  cardItem: { backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: '#E6DCE8', padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  readCard: { backgroundColor: '#FFF8FF', borderColor: '#DFCEE6' },
  cardNumber: { fontSize: 12, color: '#4E4E60' },
  cardItemTitle: { color: C.black, fontSize: 16, fontWeight: '800', marginBottom: 4 },
  cardItemBody: { color: '#42444B', fontSize: 12, lineHeight: 18 },
  choiceGroup: { borderWidth: 1, borderColor: '#E3DEE5', padding: 14, borderRadius: 12, backgroundColor: C.white, marginBottom: 12 },
  choiceTitle: { color: '#4E4854', fontSize: 12, marginBottom: 8 },
  choiceValue: { color: C.black, fontSize: 16, fontWeight: '700' },
  choiceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choiceChip: { minWidth: 95, flexGrow: 1 },
  resultWrap: { flex: 1, alignItems: 'center', marginTop: 35, padding: 12 },
  resultSymbol: { fontSize: 62, color: C.black, marginBottom: 15 },
  endDate: { color: C.tealText, marginBottom: 18, fontSize: 12 },
  scoreHead: { flexDirection: 'row', paddingVertical: 8, gap: 4 },
  scoreRow: { flexDirection: 'row', paddingVertical: 8, borderBottomColor: '#F1ECF2', borderBottomWidth: 1, gap: 4 },
  scoreName: { flex: 2, color: C.black, fontSize: 13 },
  scoreNumber: { flex: 1, textAlign: 'center', fontSize: 12, color: C.black },
  separator: { height: 1, backgroundColor: '#DCDDD9', marginVertical: 16 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center', padding: 20 },
  modalKeyboard: { width: '100%', maxWidth: 380 },
  modalBox: { backgroundColor: '#F0EAF4', borderRadius: 28, padding: 24 },
  modalTitle: { color: C.black, fontSize: 21, marginBottom: 25 },
  modalInput: { backgroundColor: '#E6E0E9', borderBottomColor: C.purple, borderBottomWidth: 1, minHeight: 50, color: C.black, paddingHorizontal: 14, fontSize: 16, marginBottom: 20 },
  modalChoiceRow: { flexDirection: 'row', gap: 8, marginTop: 10 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8, marginTop: 24 },
  pickerFields: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  pickerUnit: { flex: 1 },
  pickerInput: { backgroundColor: '#E6E0E9', borderRadius: 9, borderWidth: 1, borderColor: C.purple, fontSize: 46, height: 72, textAlign: 'center', color: C.purple },
  pickerColon: { fontSize: 40, paddingHorizontal: 8, marginTop: 7 },
  pickerCaption: { color: '#514D56', fontSize: 12, marginTop: 8 },
});
