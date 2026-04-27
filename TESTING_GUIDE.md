# Testing Guide: Marungko Phonics PWA

## 🧪 Testing Checklist

### 1. **Offline Functionality**

#### Service Worker Registration
- [ ] Open DevTools (F12) → Application tab
- [ ] Check Service Workers section
- [ ] Verify `/sw.js` is registered and active
- [ ] Status should show "activated and running"

#### Offline Testing
- [ ] Go to Network tab in DevTools
- [ ] Check "Offline" checkbox
- [ ] Refresh the page
- [ ] App should still load and function
- [ ] All assets should load from cache

#### Cache Verification
- [ ] Go to Application → Cache Storage
- [ ] Verify `marungko-phonics-v1` cache exists
- [ ] Check that static assets are cached

### 2. **PWA Installation**

#### Desktop (Chrome)
- [ ] Click the install icon in address bar
- [ ] Confirm installation
- [ ] App should open in standalone window
- [ ] No browser chrome should be visible

#### Mobile (iOS)
- [ ] Open app in Safari
- [ ] Tap Share button
- [ ] Select "Add to Home Screen"
- [ ] App should appear on home screen
- [ ] Tap to launch as standalone app

#### Mobile (Android)
- [ ] Open app in Chrome
- [ ] Tap menu (three dots)
- [ ] Select "Install app" or "Add to Home Screen"
- [ ] App should appear on home screen
- [ ] Tap to launch as standalone app

### 3. **Core Features**

#### Home Screen
- [ ] Landing page displays correctly
- [ ] Marungko mascot image loads
- [ ] "Start Learning" button is clickable
- [ ] Progress bar shows correctly (if returning user)
- [ ] Colors match design palette

#### Letter Instruction (Tracing)
- [ ] Letter appears with guide outline
- [ ] Canvas is responsive to mouse/touch
- [ ] Drawing creates orange strokes
- [ ] "Clear" button resets canvas
- [ ] "Done Tracing" button appears after drawing
- [ ] Context image reveals after completion
- [ ] Sound plays (console.log for now)

#### Structured Activity (Listen & Circle)
- [ ] Scene image displays correctly
- [ ] "Play Sound" button is visible (guided mode)
- [ ] Three letter options appear as large buttons
- [ ] Selecting correct answer shows green feedback
- [ ] Selecting wrong answer shows red feedback
- [ ] "Continue" button appears after correct answer
- [ ] "Try Again" button appears after wrong answer

#### Assessment
- [ ] Quiz displays correctly
- [ ] Progress dots show (0/3, 1/3, 2/3, 3/3)
- [ ] Letter options are clickable
- [ ] Feedback messages are appropriate
- [ ] After 3 correct answers, shows "Letter Mastered!"
- [ ] Moves to next letter or home screen

### 4. **Progress Tracking**

#### LocalStorage
- [ ] Open DevTools → Application → Local Storage
- [ ] Check for `marungko-progress` key
- [ ] Verify JSON structure contains letter data
- [ ] Progress persists after page refresh
- [ ] Progress persists after closing browser

#### Progress Display
- [ ] Header shows current letter number
- [ ] Progress bar updates as letters are completed
- [ ] Completed letters are marked in progress data

### 5. **UI/UX Polish**

#### Animations
- [ ] Reward feedback appears on correct answers
- [ ] Confetti animation triggers for correct answers
- [ ] Bounce animation on feedback messages
- [ ] Smooth transitions between screens
- [ ] No janky or stuttering animations

#### Accessibility
- [ ] Large buttons are easy to tap (>44px)
- [ ] Text is readable against backgrounds
- [ ] Color contrast meets WCAG standards
- [ ] Touch targets don't overlap
- [ ] Keyboard navigation works (Tab, Enter)

#### Responsiveness
- [ ] App works on mobile (375px width)
- [ ] App works on tablet (768px width)
- [ ] App works on desktop (1024px+ width)
- [ ] Canvas scales appropriately
- [ ] Buttons remain clickable on all sizes

### 6. **Performance**

#### Load Time
- [ ] First load completes in <3 seconds
- [ ] Subsequent loads complete in <1 second (cached)
- [ ] No console errors or warnings
- [ ] Network requests are minimal

#### Memory Usage
- [ ] App doesn't consume excessive memory
- [ ] No memory leaks after extended use
- [ ] Smooth performance on low-end devices

### 7. **Cross-Browser Testing**

#### Chrome/Edge
- [ ] All features work correctly
- [ ] Service Worker registers
- [ ] PWA installation works

#### Firefox
- [ ] All features work correctly
- [ ] Service Worker registers (if supported)
- [ ] Canvas drawing works

#### Safari (iOS)
- [ ] App loads correctly
- [ ] Touch interactions work
- [ ] Add to Home Screen works
- [ ] Offline functionality works (limited)

### 8. **Data Persistence**

#### Scenario 1: New User
- [ ] First letter is M
- [ ] Progress shows 0%
- [ ] Can complete tracing activity
- [ ] Data saves to LocalStorage

#### Scenario 2: Returning User
- [ ] App loads with saved progress
- [ ] Correct letter is displayed
- [ ] Progress bar shows completion percentage
- [ ] Can continue from where they left off

#### Scenario 3: Clear Data
- [ ] User can manually clear browser data
- [ ] App resets to initial state
- [ ] Progress is lost (expected)
- [ ] App still functions normally

## 🚀 Deployment Testing

### Build Process
```bash
npm run build
npm run preview
```

- [ ] Build completes without errors
- [ ] No console errors in preview
- [ ] All assets are bundled correctly
- [ ] Service Worker is included in build

### Production Checklist
- [ ] manifest.json is valid
- [ ] Icons are properly configured
- [ ] Theme color matches design
- [ ] Start URL is correct
- [ ] Display mode is standalone
- [ ] Orientation is portrait-primary

## 📊 Performance Metrics

### Target Metrics
- **First Contentful Paint (FCP)**: < 2 seconds
- **Largest Contentful Paint (LCP)**: < 3 seconds
- **Time to Interactive (TTI)**: < 3 seconds
- **Cumulative Layout Shift (CLS)**: < 0.1
- **Cache Size**: < 5MB

### Testing with Lighthouse
1. Open DevTools → Lighthouse
2. Select "PWA" category
3. Run audit
4. Target score: 90+

## 🎓 User Testing (Grade 1 Learners)

### Observation Points
- [ ] Can learners navigate the app independently?
- [ ] Do learners understand the tracing activity?
- [ ] Can learners select correct answers?
- [ ] Do learners respond to reward feedback?
- [ ] Is the app engaging for extended periods?

### Feedback Collection
- [ ] Observe learner behavior
- [ ] Note any confusion or frustration
- [ ] Record completion times
- [ ] Collect qualitative feedback

## 🐛 Known Issues & Workarounds

### Issue 1: Service Worker Not Updating
**Workaround**: Clear browser cache and reload

### Issue 2: Canvas Drawing Lag on Low-End Devices
**Workaround**: Reduce canvas resolution or use requestAnimationFrame

### Issue 3: Audio Not Playing
**Current Status**: Placeholder implementation (console.log)
**Next Step**: Integrate Web Audio API or audio files

## ✅ Final Verification

Before deployment:
- [ ] All tests pass
- [ ] No console errors
- [ ] Offline functionality verified
- [ ] PWA installation works
- [ ] Performance metrics acceptable
- [ ] User testing completed
- [ ] README is up to date
- [ ] Code is clean and documented

---

**Last Updated**: April 24, 2026
**Version**: 1.0.0
