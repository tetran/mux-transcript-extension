const { createMinDisplayController } = require('../src/utils');

describe('createMinDisplayController', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('bypass=true のとき即時更新される', () => {
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    ctrl.update(3, true);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(3);
  });

  test('minMs=0 のとき即時更新される', () => {
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(0, onUpdate);

    ctrl.update(5);

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(5);
  });

  test('minMs>0 で十分な時間が経過していれば即時更新される', () => {
    jest.setSystemTime(0);
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    // 最初の更新
    ctrl.update(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 2000ms 以上経過
    jest.setSystemTime(3000);

    ctrl.update(1);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
  });

  test('経過時間が足りなければ遅延後に更新される', () => {
    jest.setSystemTime(0);
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    // 最初の更新（即時）
    ctrl.update(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 500ms しか経過していない
    jest.setSystemTime(500);

    ctrl.update(1);
    // まだ更新されていない
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 残り 1500ms を進める
    jest.advanceTimersByTime(1500);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
  });

  test('遅延中に次の timeupdate が来たら前のタイマーをキャンセルして再スケジュールする', () => {
    jest.setSystemTime(0);
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    // 最初の更新（即時）
    ctrl.update(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 500ms 後に index=1 で更新（遅延スケジュール）
    jest.setSystemTime(500);
    ctrl.update(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // さらに 300ms 後に index=2 で更新（前のタイマーをキャンセル）
    jest.setSystemTime(800);
    ctrl.update(2);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 残り 1200ms 進める（index=1 のタイマーは既にキャンセルされている）
    jest.advanceTimersByTime(1200);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(2);
  });

  test('遅延中に bypass=true の更新が来たら旧タイマーをキャンセルして即時更新する', () => {
    jest.setSystemTime(0);
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    // 最初の更新（即時）
    ctrl.update(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 500ms 後に timeupdate（遅延スケジュール）
    jest.setSystemTime(500);
    ctrl.update(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // seeked イベントで bypass=true
    jest.setSystemTime(600);
    ctrl.update(5, true);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(5);

    // 旧タイマーが残っていないことを確認（時間を進めても追加呼び出しなし）
    jest.advanceTimersByTime(5000);
    expect(onUpdate).toHaveBeenCalledTimes(2);
  });

  test('表示中と同じ index が来ても lastShownAt が更新されず次の字幕切り替えが遅れない', () => {
    jest.setSystemTime(0);
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    // index=0 を表示
    ctrl.update(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 2100ms 後: elapsed >= minMs になる timeupdate(index=0) が来る
    jest.setSystemTime(2100);
    ctrl.update(0); // 同一 index → lastShownAt を更新しないはず
    expect(onUpdate).toHaveBeenCalledTimes(1); // DOM 更新なし

    // 2200ms 後: index が 0→1 に変わる
    jest.setSystemTime(2200);
    ctrl.update(1);
    // elapsed = 2200 - 0 = 2200 >= 2000 → 即時更新されるべき
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
  });

  test('pending timer と同じ index が来てもタイマーがリセットされない', () => {
    jest.setSystemTime(0);
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    ctrl.update(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 500ms 後: index=1 で遅延スケジュール（残り 1500ms）
    jest.setSystemTime(500);
    ctrl.update(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 300ms 後: 同じ index=1 が来る → タイマーをリセットしてはいけない
    jest.setSystemTime(800);
    ctrl.update(1);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // タイマーがリセットされていれば 1200ms 後（fake clock 基準）に発火するが、
    // リセットされていなければ元の 1500ms 後まで発火しない
    jest.advanceTimersByTime(1200);
    expect(onUpdate).toHaveBeenCalledTimes(1); // まだ発火しない

    // 残り 300ms 進める → 合計 1500ms → 元のタイマーが発火する
    jest.advanceTimersByTime(300);
    expect(onUpdate).toHaveBeenCalledTimes(2);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
  });

  test('bypass=true かつ同一 index でも lastShownAt が更新される', () => {
    jest.setSystemTime(0);
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    ctrl.update(0); // t=0, lastShownAt=0
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 100ms 後: seeked で同じ index=0 に着地（bypass=true）
    jest.setSystemTime(100);
    ctrl.update(0, true); // bypass → lastShownAt を 100 に更新すべき
    expect(onUpdate).toHaveBeenCalledTimes(2);

    // 2050ms 後: index=1 に切り替わる
    // elapsed = 2050 - 100 = 1950 < 2000 → 遅延になるべき
    jest.setSystemTime(2050);
    ctrl.update(1);
    expect(onUpdate).toHaveBeenCalledTimes(2); // まだ発火しない

    jest.advanceTimersByTime(50);
    expect(onUpdate).toHaveBeenCalledTimes(3);
    expect(onUpdate).toHaveBeenLastCalledWith(1);
  });

  test('dispose() でタイマーがキャンセルされる', () => {
    jest.setSystemTime(0);
    const onUpdate = jest.fn();
    const ctrl = createMinDisplayController(2000, onUpdate);

    // 最初の更新（即時）
    ctrl.update(0);
    expect(onUpdate).toHaveBeenCalledTimes(1);

    // 遅延スケジュール
    jest.setSystemTime(500);
    ctrl.update(1);

    // dispose
    ctrl.dispose();

    // 時間を進めてもコールバックが呼ばれない
    jest.advanceTimersByTime(5000);
    expect(onUpdate).toHaveBeenCalledTimes(1);
  });
});
