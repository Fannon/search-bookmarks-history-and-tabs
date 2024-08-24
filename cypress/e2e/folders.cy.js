describe('Folder View', () => {
  beforeEach(() => {
    cy.visit('/#folders/')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#folders-overview').find('#folders-list')
    })
    it('contains a list of folders', () => {
      cy.get('#folders-overview').find('#folders-list').find('[x-folder=Tools]').checkNoErrors()
    })
    it('can use folders for navigation', () => {
      cy.get('#folders-overview')
        .find('#folders-list')
        .find('[x-folder=Tools]')
        .click()
      cy.get('#search-input').should('have.value', '~Tools')
      cy.get('#result-list').should('not.have.length', 0)
        .find('[x-original-id=6]')
      cy.get('#result-list').find('li.bookmark')
      cy.checkNoErrors()
    })
  })
})
