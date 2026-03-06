# How ChatBox.tsx Works

## State — the component's memory

```ts
const [messages, setMessages] = useState<Message[]>([]);
const [input, setInput] = useState("");
const [loading, setLoading] = useState(false);
const bottomRef = useRef<HTMLDivElement>(null);
```

`useState` is how a component remembers things between renders. Every time you call a setter (`setMessages`, `setInput`, `setLoading`), React re-renders the component with the new value.

- `messages` — the full conversation history (array of `{role, content, toolCalls}`)
- `input` — what's currently typed in the text box
- `loading` — whether we're waiting for a response (controls spinner + disabling the button)

`useRef` is different — it holds a reference to a real DOM element (the invisible `<div>` at the bottom of the list). It doesn't trigger re-renders when it changes. Used only for scrolling.

---

## The controlled input

```ts
<input
  value={input}
  onChange={(e) => setInput(e.target.value)}
/>
```

This is called a **controlled input**. React owns the value — the input shows whatever `input` state contains, and every keystroke calls `setInput` to update it. The browser's native input value is never the source of truth; React's state is.

---

## What happens when you click Send

```
1. sendMessage() fires (form's onSubmit)
2. e.preventDefault()           → stops the browser from doing a full page reload
3. Append user message to state → React re-renders, bubble appears immediately
4. setInput("")                 → clears the text box
5. setLoading(true)             → "Claude is thinking..." appears
6. fetch("/api/chat", ...)      → POST to our own route handler (waits here)
7. data = await res.json()      → parse the JSON response
8. Append Claude's reply        → React re-renders, reply bubble appears
9. setLoading(false)            → spinner disappears
```

Step 3 is called **optimistic update** — we show the user's message immediately without waiting for the server. This makes the UI feel instant.

---

## Why `updatedMessages` instead of just `messages`

```ts
const updatedMessages = [...messages, userMsg];
setMessages(updatedMessages);          // schedule a re-render
// ...
body: JSON.stringify({ messages: updatedMessages })  // use THIS, not messages
```

This is a subtle React gotcha. `setMessages` doesn't update `messages` immediately — it schedules a re-render. So if you used `messages` in the fetch body on the next line, it would be the **old** array without the user's message. By saving to `updatedMessages` first, you use the correct, current value everywhere.

---

## The message list (rendering)

```tsx
{messages.map((msg, i) => (
  <div className={msg.role === "user" ? "justify-end" : "justify-start"}>
    ...
  </div>
))}
```

`.map()` turns the `messages` array into an array of JSX elements. User messages get `justify-end` (right-aligned, blue bubble). Claude's get `justify-start` (left-aligned, dark bubble). Every time `messages` state updates, React re-runs this and updates the DOM.

---

## Auto-scroll

```ts
useEffect(() => {
  bottomRef.current?.scrollIntoView({ behavior: "smooth" });
}, [messages, loading]);
```

`useEffect` runs **after** every render where `messages` or `loading` changed. At that point the DOM is updated and the new bubble exists, so scrolling to `bottomRef` (that invisible div pinned below all messages) brings it into view. The `?` is optional chaining — safe if `bottomRef.current` is null.

---

## try / catch / finally

```ts
try {
  // fetch + update messages
} catch (err) {
  // show a network error bubble
} finally {
  setLoading(false);  // ALWAYS runs, even if fetch threw
}
```

`finally` is the key part — `setLoading(false)` goes there so the spinner always clears, whether the request succeeded or crashed.
