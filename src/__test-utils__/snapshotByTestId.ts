/**
 * snapshotByTestId — render(...).toJSON() 트리에서 testID 일치 서브트리만 추출.
 *
 * TESTING.md §6.6 "스냅샷 100라인 정책" 준수용 — 화면 전체 트리 대신 핵심 영역만
 * 캡처. ReactTestInstance 는 circular reference 때문에 직접 toMatchSnapshot 에
 * 넘기면 RangeError. JSON 트리 traversal 로 우회.
 */

type RenderJSON = {
  type: string | { displayName?: string };
  props: Record<string, unknown>;
  children: RenderJSON[] | null;
};

function find(node: RenderJSON | RenderJSON[] | null, testID: string): RenderJSON | null {
  if (node === null) return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = find(child, testID);
      if (found) return found;
    }
    return null;
  }
  if (typeof node !== 'object') return null;
  if (node.props?.['testID'] === testID) return node;
  return find(node.children, testID);
}

/**
 * render(...).toJSON() 결과에서 `testID` 노드를 찾아 반환. 못 찾으면 throw.
 */
export function jsonByTestId(
  tree: RenderJSON | RenderJSON[] | null,
  testID: string,
): RenderJSON {
  const found = find(tree, testID);
  if (!found) {
    throw new Error(`jsonByTestId: testID "${testID}" not found in tree`);
  }
  return found;
}
