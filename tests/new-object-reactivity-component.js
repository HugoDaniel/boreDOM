import { webComponent } from "/dist/boreDOM.min.js"

// Tests that new/replaced objects become reactive
export const NewObjectReactivityComponent = webComponent(({ on }) => {
  on("replaceUser", ({ state: mutable }) => {
    mutable.user = { name: "Replaced", email: "replaced@test.com" }
  })

  on("mutateNewUser", ({ state: mutable }) => {
    // This mutation should trigger re-render after the fix
    mutable.user.name = "Mutated"
  })

  on("addNestedObject", ({ state: mutable }) => {
    mutable.user.profile = { bio: "New bio", age: 30 }
  })

  on("mutateNestedObject", ({ state: mutable }) => {
    // This should also trigger re-render after the fix
    mutable.user.profile.bio = "Updated bio"
  })

  on("replaceWithDeepObject", ({ state: mutable }) => {
    mutable.data = {
      level1: {
        level2: {
          level3: { value: "deep" }
        }
      }
    }
  })

  on("mutateDeepObject", ({ state: mutable }) => {
    mutable.data.level1.level2.level3.value = "mutated deep"
  })

  on("replaceArray", ({ state: mutable }) => {
    mutable.items = ["new1", "new2", "new3"]
  })

  on("mutateNewArray", ({ state: mutable }) => {
    mutable.items[0] = "mutated"
  })

  on("pushToNewArray", ({ state: mutable }) => {
    mutable.items.push("pushed")
  })

  let renderCount = 0

  return ({ self, state }) => {
    renderCount++
    self.setAttribute("data-render-count", String(renderCount))
    self.setAttribute("data-user-name", state.user?.name ?? "none")
    self.setAttribute("data-user-email", state.user?.email ?? "none")
    self.setAttribute("data-profile-bio", state.user?.profile?.bio ?? "none")
    self.setAttribute("data-deep-value", state.data?.level1?.level2?.level3?.value ?? "none")
    self.setAttribute("data-items", state.items?.join(",") ?? "none")
  }
})
