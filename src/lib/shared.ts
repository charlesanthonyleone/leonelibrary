import { load, save, type Highlight } from './store';
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const STARTER = [
  { id: 1342, title: 'Pride and Prejudice', author: 'Jane Austen' }, { id: 84, title: 'Frankenstein', author: 'Mary Shelley' },
  { id: 2554, title: 'Crime and Punishment', author: 'Fyodor Dostoevsky' }, { id: 1661, title: 'The Adventures of Sherlock Holmes', author: 'Arthur Conan Doyle' },
  { id: 345, title: 'Dracula', author: 'Bram Stoker' }, { id: 64317, title: 'The Great Gatsby', author: 'F. Scott Fitzgerald' },
  { id: 2701, title: 'Moby Dick', author: 'Herman Melville' }, { id: 11, title: "Alice's Adventures in Wonderland", author: 'Lewis Carroll' },
  { id: 1513, title: 'Romeo and Juliet', author: 'William Shakespeare' }, { id: 1260, title: 'Jane Eyre', author: 'Charlotte Brontë' },
  { id: 98, title: 'A Tale of Two Cities', author: 'Charles Dickens' }, { id: 174, title: 'The Picture of Dorian Gray', author: 'Oscar Wilde' },
  { id: 1400, title: 'Great Expectations', author: 'Charles Dickens' }, { id: 768, title: 'Wuthering Heights', author: 'Emily Brontë' },
  { id: 1184, title: 'The Count of Monte Cristo', author: 'Alexandre Dumas' }, { id: 2600, title: 'War and Peace', author: 'Leo Tolstoy' },
  { id: 1399, title: 'Anna Karenina', author: 'Leo Tolstoy' }, { id: 158, title: 'Emma', author: 'Jane Austen' },
  { id: 161, title: 'Sense and Sensibility', author: 'Jane Austen' }, { id: 1952, title: 'The Yellow Wallpaper', author: 'Charlotte Perkins Gilman' },
  { id: 120, title: 'Treasure Island', author: 'Robert Louis Stevenson' }, { id: 43, title: 'Dr Jekyll and Mr Hyde', author: 'Robert Louis Stevenson' },
  { id: 36, title: 'The War of the Worlds', author: 'H. G. Wells' }, { id: 35, title: 'The Time Machine', author: 'H. G. Wells' },
  { id: 1080, title: 'A Modest Proposal', author: 'Jonathan Swift' }, { id: 829, title: "Gulliver's Travels", author: 'Jonathan Swift' },
  { id: 4300, title: 'Ulysses', author: 'James Joyce' },
  { id: 1232, title: 'The Prince', author: 'Niccolò Machiavelli' }, { id: 205, title: 'Walden', author: 'Henry David Thoreau' },
];
export function logReading(min: number) { const l = load<Record<string, number>>('readlog', {}); const k = today(); save('readlog', { ...l, [k]: (l[k] || 0) + min }); }
export const shareNotesLink = (id: number, title: string, who: string, hl: Highlight[]) => `${location.origin}${import.meta.env.BASE_URL}notes#n=${btoa(unescape(encodeURIComponent(JSON.stringify({ id, title, who, hl })))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`;
