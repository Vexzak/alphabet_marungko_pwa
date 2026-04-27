# Multisensory Phonics Digital Simulation App (Marungko Approach)

A fully offline Progressive Web App (PWA) for Grade 1 Filipino learners teaching alphabet recognition, letter sounds, letter formation, and beginning sound awareness using the **Marungko Approach** with multisensory learning design.

## 🎯 Core Features

### 1. **Alphabet Recognition & Letter Sounds**
- Teaches 25 letters in the Marungko Approach sequence: m, s, a, i, o, b, e, u, t, k, l, y, n, g, h, p, r, d, c, j, f, v, z, q, x
- Each letter includes:
  - Correct phonetic sound (e.g., /m/, /s/, /a/)
  - Example word in Filipino context (e.g., mesa, araw, bahay)
  - Visual + audio + kinesthetic interaction

### 2. **Multisensory Learning Modules**

#### 🔤 Letter Instruction (Tracing)
- Interactive canvas for letter tracing (uppercase & lowercase)
- Animated letter formation with visual guides
- Context image reveal after tracing completion
- Auto-play letter sound for auditory reinforcement

#### 🎧 Structured Activities
- **Listen & Repeat**: Audio playback of phonetic sounds with learner repetition
- **Look & Circle**: Visual identification of letters from multiple choices
- Guided practice with teacher-like prompts
- Independent practice mode for self-directed learning

#### 📝 Assessment
- Letter identification quizzes
- Sound recognition tests
- Multiple-choice interactions with immediate feedback
- Progress tracking with visual indicators

### 3. **Learning Flow (5 Phases)**

1. **Anticipatory Set**: Explore app freely and observe interactions
2. **Instructional Input**: Letter tracing with visual and audio support
3. **Guided Practice**: Listen → repeat → circle activities with guidance
4. **Independent Practice**: Self-directed learning without audio support
5. **Assessment**: Embedded quizzes with automatic feedback system

### 4. **Offline PWA Capabilities**

- ✅ **Fully Offline**: Works without internet connection after first load
- ✅ **Installable**: Add to home screen on mobile devices
- ✅ **Service Worker Caching**: Automatic caching of all assets
- ✅ **LocalStorage Progress**: Saves learner progress locally
- ✅ **No Backend Required**: Completely client-side application

### 5. **Child-Friendly UI/UX**

- **Large touch-optimized buttons** for small hands
- **Vibrant, engaging colors**: Orange (#FF8C42), Teal (#1DD1A1), Yellow (#FFD93D)
- **Cartoon-style illustrations** with Filipino cultural context
- **Minimal text clutter** with clear visual hierarchy
- **Smooth animations** and reward feedback
- **Friendly mascot guide** (Marungko character) throughout the app

## 🏗️ Project Structure

```
marungko-phonics-app/
├── client/
│   ├── public/
│   │   ├── manifest.json          # PWA configuration
│   │   ├── sw.js                  # Service Worker for offline support
│   │   └── favicon.ico
│   ├── src/
│   │   ├── components/
│   │   │   ├── LetterInstruction.tsx    # Tracing canvas component
│   │   │   ├── StructuredActivity.tsx   # Listen & circle activities
│   │   │   ├── Assessment.tsx           # Quiz and assessment component
│   │   │   └── ui/                      # shadcn/ui components
│   │   ├── contexts/
│   │   │   ├── AppContext.tsx           # Global app state management
│   │   │   └── ThemeContext.tsx         # Theme management
│   │   ├── pages/
│   │   │   ├── Home.tsx                 # Main app page
│   │   │   └── NotFound.tsx
│   │   ├── App.tsx                      # Root component with routing
│   │   ├── main.tsx                     # Entry point
│   │   └── index.css                    # Global styles & Marungko color palette
│   └── index.html                       # HTML template
├── server/
│   └── index.ts                         # Express server (static serving)
├── package.json
├── tsconfig.json
└── vite.config.ts
```

## 🎨 Design System

### Color Palette (Joyful Illustrative Storytelling)
- **Primary Orange**: #FF8C42 (warm, energetic)
- **Secondary Teal**: #1DD1A1 (calm, supportive)
- **Accent Yellow**: #FFD93D (joy, celebration)
- **Soft Pink**: #FFB6C1 (gentle moments)
- **Forest Green**: #2D6A4F (grounding)
- **Cream**: #F5F1E8 (safe background)

### Typography
- **Display Font**: Fredoka (friendly, rounded, playful)
- **Body Font**: Quicksand (readable, approachable)
- **Hierarchy**: Large display (52px) for letters, medium body (18px) for instructions

### Animations
- Entrance animations with gentle bounce (300-400ms)
- Character animations (blink, wave, celebrate)
- Particle effects for rewards (confetti, sparkles)
- Smooth scene transitions

## 🚀 Getting Started

### Installation

1. **Clone or extract the project**:
   ```bash
   cd marungko-phonics-app
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Start development server**:
   ```bash
   pnpm dev
   ```

4. **Open in browser**:
   - Visit `http://localhost:3000`
   - The app will automatically register the Service Worker

### Building for Production

```bash
pnpm build
pnpm preview
```

## 📱 PWA Installation

### On Mobile (iOS/Android)
1. Open the app in your mobile browser
2. Tap the **Share** button (or menu)
3. Select **Add to Home Screen**
4. The app will be installed as a standalone app

### Features After Installation
- ✅ Works completely offline
- ✅ No internet required after first load
- ✅ All progress saved locally
- ✅ Fast loading from cache

## 💾 Data & Progress Tracking

### LocalStorage Structure
- **marungko-progress**: Stores progress for each letter
  - `letter`: Letter identifier
  - `completed`: Boolean indicating letter mastery
  - `tracingCompleted`: Tracing activity completion
  - `listeningCompleted`: Listening activity completion
  - `assessmentScore`: Quiz score (0-3)

### Data Persistence
- All progress is saved automatically to browser's LocalStorage
- Data persists across sessions
- Can be cleared by resetting browser data

## 🎓 Learning Design (Marungko Approach)

### Phonetic Sequence
The app teaches letters in this specific order for optimal phonetic learning:
1. **Vowels First**: m, s, a, i, o (foundation sounds)
2. **Common Consonants**: b, e, u, t, k, l, y, n, g, h, p, r, d
3. **Less Common**: c, j, f, v, z, q, x

### Multisensory Integration
Every activity combines:
- **Visual** → Letters, images, animations
- **Auditory** → Phonics sounds (/m/, /s/, etc.)
- **Kinesthetic** → Tracing letters on screen
- **Cognitive** → Choosing, matching, identifying

## 🔧 Technical Stack

- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS 4 + shadcn/ui
- **State Management**: React Context API
- **Routing**: Wouter
- **PWA**: Service Worker + Web App Manifest
- **Storage**: Browser LocalStorage

## ⚙️ Configuration Files

### manifest.json
Configures PWA installation, app name, icons, and display settings.

### sw.js (Service Worker)
Handles offline caching strategy:
- Cache-first for static assets
- Network-first for dynamic content
- Fallback to cached index.html for offline access

## 📊 Implementation Schedule

### Pre-test
- 52-item alphabet diagnostic test (placeholder)

### Week 1
- Letters: m, s, a → gradual expansion

### Week 2
- Full alphabet completion

### Post-test
- Same 52-item test for comparison

## 🎯 Success Metrics

For Grade 1 learners (37 participants):
- **Letter Recognition**: Ability to identify uppercase and lowercase letters
- **Letter-Sound Correspondence**: Matching letters to their phonetic sounds
- **Beginning Sound Identification**: Recognizing initial sounds in words
- **Overall Progress**: Tracked via assessment scores and completion rates

## 🐛 Known Limitations

- Audio playback is currently a placeholder (console.log)
- To add real audio, integrate Web Audio API or use audio files
- Touch support for canvas tracing is available but not yet optimized for all devices
- Some older browsers may not support Service Workers

## 🔮 Future Enhancements

1. **Audio Integration**: Real phonetic sound recordings in Filipino
2. **Syllable Blending**: Combining letters to form simple words
3. **Word Recognition**: Identifying complete words
4. **Teacher Dashboard**: Monitor learner progress across multiple students
5. **Gamification**: Points, badges, and leaderboards
6. **Multilingual Support**: English and other languages
7. **Accessibility**: Screen reader support, high contrast mode
8. **Analytics**: Detailed learning analytics and reports

## 📝 License

This project is designed for educational purposes for Grade 1 Filipino learners.

## 🤝 Contributing

To contribute improvements:
1. Test on low-end devices
2. Gather feedback from Grade 1 learners
3. Submit improvements via pull requests

## 📞 Support

For issues or questions:
- Check the browser console for error messages
- Verify Service Worker registration in DevTools
- Clear LocalStorage if experiencing data issues
- Test offline functionality by disconnecting internet

---

**Built with ❤️ for Grade 1 Filipino Learners using the Marungko Approach**
