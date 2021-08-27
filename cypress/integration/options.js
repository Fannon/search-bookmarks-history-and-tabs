describe('Options View', () => {
  beforeEach(() => {
    cy.visit('/options.html')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#options').find('#user-config')
    })
    it('successfully loads the default user config', () => {
      cy.get('#user-config').should('have.value', '{}')
    })
    it('can save a new user config', () => {
      const newConfig = JSON.stringify(
        {
          visitCounter: true,
          dateAdded: true,
        },
        null,
        2,
      )
      cy.get('#user-config')
        .type('{backspace}{backspace}')
        .should('have.value', '')
        .type(newConfig)
        .get('#edit-options-save')
        .click()
        .visit('/options.html')
        .get('#user-config')
        .should('include.value', 'visitCounter')
        .should('include.value', 'dateAdded')
    })
  })
})
