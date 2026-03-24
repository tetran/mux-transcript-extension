const { findTranscriptTab } = require('../src/utils');

function buildTabContainer(labels) {
  const container = document.createElement('div');
  labels.forEach((label) => {
    const btn = document.createElement('button');
    btn.textContent = label;
    container.appendChild(btn);
  });
  return container;
}

describe('findTranscriptTab', () => {
  test('「Transcript」というテキストの button を返す', () => {
    const container = buildTabContainer(['Lesson content', 'Transcript', 'Progress']);
    document.body.appendChild(container);

    const result = findTranscriptTab(document);
    expect(result).not.toBeNull();
    expect(result.textContent.trim()).toBe('Transcript');

    document.body.removeChild(container);
  });

  test('前後に空白があっても trim して見つかる', () => {
    const container = document.createElement('div');
    const btn = document.createElement('button');
    btn.textContent = '  Transcript  ';
    container.appendChild(btn);
    document.body.appendChild(container);

    const result = findTranscriptTab(document);
    expect(result).not.toBeNull();

    document.body.removeChild(container);
  });

  test('Transcript ボタンが存在しない場合は null を返す', () => {
    const container = buildTabContainer(['Lesson content', 'Progress']);
    document.body.appendChild(container);

    const result = findTranscriptTab(document);
    expect(result).toBeNull();

    document.body.removeChild(container);
  });

  test('別のボタンテキスト（"Lesson content"）にはマッチしない', () => {
    const container = buildTabContainer(['Lesson content']);
    document.body.appendChild(container);

    const result = findTranscriptTab(document);
    expect(result).toBeNull();

    document.body.removeChild(container);
  });
});
