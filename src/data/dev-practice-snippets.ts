import type { Snippet } from "@/types";

export interface CategorySnippet extends Snippet {
  category: "symbols" | "terminal" | "algorithms";
  title?: string;
  description?: string;
}

export const SYMBOL_DRILLS: CategorySnippet[] = [
  {
    id: "sym-1",
    language: "TypeScript",
    category: "symbols",
    title: "Brackets, Arrows & Destructuring",
    description: "Train muscle memory for curly braces, array destructuring, and arrow functions.",
    code: `const processUsers = ({ users, options }: { users: User[]; options: Config }) => {
  const activeIds = users.filter((u) => u.isActive && u.score >= 50).map(({ id }) => id);
  return { activeIds, count: activeIds.length, timestamp: Date.now() };
};`,
  },
  {
    id: "sym-2",
    language: "TypeScript",
    category: "symbols",
    title: "Ternaries, Nullish & Optional Chaining",
    description: "Focus on ?, :, ??, and ?. operators.",
    code: `const displayTitle = item?.metadata?.title ?? (item?.isDraft ? "Untitled Draft" : "Default Header");
const statusColor = isError ? "red" : isWarning ? "yellow" : isSuccess ? "green" : "gray";
const endpoint = process.env.API_HOST?.trim() || "http://localhost:3000";`,
  },
  {
    id: "sym-3",
    language: "Rust",
    category: "symbols",
    title: "Rust Pointers & Pattern Matching",
    description: "Practice Rust symbols like ::, ->, &, mut, match arms, and Result types.",
    code: `pub fn parse_header<'a>(input: &'a str) -> Result<Header<'a>, ParseError> {
    match input.split_once(':') {
        Some((key, val)) => Ok(Header { name: key.trim(), value: val.trim() }),
        None => Err(ParseError::InvalidFormat),
    }
}`,
  },
  {
    id: "sym-4",
    language: "C++",
    category: "symbols",
    title: "C++ Pointers, References & Templates",
    description: "Focus on *, &, ->, ::, and template brackets < >.",
    code: `template <typename T>
void LinkedList<T>::insert(const T& value) {
    Node* newNode = new Node{value, nullptr};
    if (!head) { head = tail = newNode; }
    else { tail->next = newNode; tail = newNode; }
}`,
  },
  {
    id: "sym-5",
    language: "JavaScript",
    category: "symbols",
    title: "Template Strings, Spread & Regex",
    description: "Practice backticks \${}, regex delimiters /.../g, and spread operators ...",
    code: `const sanitizeUrl = (raw: string): string => {
  const match = raw.match(/^https?:\\/\\/([^\\/]+)(\\/.*)?$/i);
  const domain = match?.[1] ?? "unknown";
  return \`https://\${domain.toLowerCase()}\${match?.[2] || "/"}\`;
};`,
  },
];

export const TERMINAL_COMMANDS: CategorySnippet[] = [
  {
    id: "term-1",
    language: "Bash",
    category: "terminal",
    title: "Git Feature Branch Workflow",
    description: "Common Git branch creation, staging, and commit with flag switches.",
    code: `git checkout -b feature/oauth-login
git add src/lib/auth.ts src/components/Login.tsx
git commit -m "feat(auth): integrate appwrite oauth provider"
git push -u origin feature/oauth-login`,
  },
  {
    id: "term-2",
    language: "Bash",
    category: "terminal",
    title: "Git Interactive Rebase & Stash",
    description: "Advanced Git commands for cleanup and stashing.",
    code: `git stash save "wip before rebase"
git fetch origin main
git rebase -i origin/main
git stash pop`,
  },
  {
    id: "term-3",
    language: "Bash",
    category: "terminal",
    title: "Docker Container Management",
    description: "Docker run with environment variables, ports, and volumes.",
    code: `docker run -d --name redis-cache \\
  -p 6379:6379 \\
  -v redis-data:/data \\
  --restart unless-stopped \\
  redis:alpine`,
  },
  {
    id: "term-4",
    language: "Bash",
    category: "terminal",
    title: "Kubernetes & Cluster Debugging",
    description: "Kubectl commands for listing, logging, and executing in pods.",
    code: `kubectl get pods -n kube-system -o wide
kubectl logs -f deployment/api-gateway --tail=100
kubectl exec -it pod/db-client-0 -- /bin/sh`,
  },
  {
    id: "term-5",
    language: "Bash",
    category: "terminal",
    title: "Linux Find & Grep One-Liners",
    description: "File search and regex filtering in terminal.",
    code: `grep -rnw './src' -e 'TODO:' --exclude-dir=node_modules
find . -type f -name "*.log" -mtime +7 -exec rm -f {} +
curl -sX POST https://api.example.com/v1/auth -H "Content-Type: application/json" -d '{"token":"xyz"}'`,
  },
];

export const ALGORITHM_SNIPPETS: CategorySnippet[] = [
  {
    id: "algo-1",
    language: "TypeScript",
    category: "algorithms",
    title: "Binary Search (O(log n))",
    description: "Classic iterative binary search implementation.",
    code: `function binarySearch(nums: number[], target: number): number {
  let left = 0;
  let right = nums.length - 1;
  while (left <= right) {
    const mid = Math.floor(left + (right - left) / 2);
    if (nums[mid] === target) return mid;
    if (nums[mid] < target) left = mid + 1;
    else right = mid - 1;
  }
  return -1;
}`,
  },
  {
    id: "algo-2",
    language: "Python",
    category: "algorithms",
    title: "Two Pointers - Valid Palindrome",
    description: "Efficient string comparison with two pointers.",
    code: `def is_palindrome(s: str) -> bool:
    clean = [c.lower() for c in s if c.isalnum()]
    left, right = 0, len(clean) - 1
    while left < right:
        if clean[left] != clean[right]:
            return False
        left += 1
        right -= 1
    return True`,
  },
  {
    id: "algo-3",
    language: "TypeScript",
    category: "algorithms",
    title: "BFS Graph Level-Order Traversal",
    description: "Breadth-first search using a FIFO queue.",
    code: `function levelOrder(root: TreeNode | null): number[][] {
  if (!root) return [];
  const result: number[][] = [];
  const queue: TreeNode[] = [root];
  while (queue.length > 0) {
    const levelSize = queue.length;
    const currentLevel: number[] = [];
    for (let i = 0; i < levelSize; i++) {
      const node = queue.shift()!;
      currentLevel.push(node.val);
      if (node.left) queue.push(node.left);
      if (node.right) queue.push(node.right);
    }
    result.push(currentLevel);
  }
  return result;
}`,
  },
  {
    id: "algo-4",
    language: "Python",
    category: "algorithms",
    title: "Dynamic Programming - Memoized Fibonacci",
    description: "Top-down DP with recursion and dictionary memoization.",
    code: `def fib(n: int, memo: dict = {}) -> int:
    if n in memo:
        return memo[n]
    if n <= 1:
        return n
    memo[n] = fib(n - 1, memo) + fib(n - 2, memo)
    return memo[n]`,
  },
];
