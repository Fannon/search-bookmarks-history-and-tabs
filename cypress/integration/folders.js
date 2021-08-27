describe('Folder View', () => {
  beforeEach(() => {
    cy.visit('/#folders/')
  })

  describe('Initializing Phase', () => {
    it('successfully loads', () => {
      cy.get('#folders-overview').find('#folders-list')
    })
    it('contains a list of folders', () => {
      cy.get('#folders-overview').find('#folders-list').find('[x-folder=Tools]')
    })
    it('can use folders for navigation', () => {
      cy.get('#folders-overview')
        .find('#folders-list')
        .find('[x-folder=Tools]')
        .click()
        .get('#search-input')
        .should('have.value', '~Tools')
        .get('#result-list')
        .should('not.have.length', 0)
        .find('[x-original-id=9]')
        .get('#result-list')
        .find('li.bookmark')
    })
  })
})
