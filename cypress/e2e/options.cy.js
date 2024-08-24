describe('Options View', () => {
  beforeEach(() => {
    cy.visit('/options.html')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#options').find('#user-config')
    })
    it('successfully loads the default user config', () => {
      cy.get('#user-config').should('include.value', 'searchStrategy').checkNoErrors()
    })
    it('can save a new user config in JSON format', () => {
      const newConfig = JSON.stringify(
        {
          displayVisitCounter: true,
          displayDateAdded: true,
        },
        null,
        2,
      )
      cy.get('#user-config')
        .clear()
        .should('have.value', '')
        .type(newConfig)
      cy.get('#edit-options-save')
        .click()
        .visit('/options.html')
      cy.get('#user-config')
        .should('include.value', 'displayVisitCounter')
        .should('include.value', 'displayDateAdded')
        .checkNoErrors()
    })
    it('can save a new user config in YAML format', () => {
      const newConfig = `displayVisitCounter: true\ndisplayDateAdded: true`
      cy.get('#user-config')
        .clear()
        .should('have.value', '')
        .type(newConfig)
      cy.get('#edit-options-save')
        .click()
        .visit('/options.html')
      cy.get('#user-config')
        .should('include.value', 'displayVisitCounter')
        .should('include.value', 'displayDateAdded')
        .checkNoErrors()
    })
  })
})
