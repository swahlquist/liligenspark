require 'spec_helper'

describe UserExtra, type: :model do
  it "should generate defaults" do
    e = UserExtra.create
    expect(e.settings).to_not eq(nil)
  end

  describe "tag_board" do
    it "should return nil without valid settings" do
      e = UserExtra.new
      expect(e.tag_board(nil, nil, nil, nil)).to eq(nil)
      b = Board.new
      expect(e.tag_board(b, nil, nil, nil)).to eq(nil)
      u = User.create
      b = Board.create(user: u)
      expect(e.tag_board(b, nil, nil, nil)).to eq(nil)
      expect(e.tag_board(b, "", nil, nil)).to eq(nil)
    end

    it "should remove a tag if specified" do
      u = User.create
      e = UserExtra.create(user: u)
      b = Board.create(user: u)
      expect(u.user_extra).to eq(e)
      e.settings['board_tags'] = {
        'bacon' => ['a', 'b', 'c', b.global_id, 'd'],
        'cheddar' => ['aa', b.global_id]
      }
      expect(e.tag_board(b, 'bacon', true, false)).to eq(['bacon', 'cheddar'])
      expect(e.settings['board_tags']['bacon']).to eq(['a', 'b', 'c', 'd'])
      expect(e.settings['board_tags']['cheddar']).to eq(['aa', b.global_id])
      expect(e.tag_board(b, 'cheddar', true, false)).to eq(['bacon', 'cheddar'])
      expect(e.settings['board_tags']['bacon']).to eq(['a', 'b', 'c', 'd'])
      expect(e.settings['board_tags']['cheddar']).to eq(['aa'])
    end

    it "should not error when removing non-existent tag" do
      u = User.create
      e = UserExtra.create(user: u)
      b = Board.create(user: u)
      expect(u.user_extra).to eq(e)
      e.settings['board_tags'] = {
        'bacon' => ['a', 'b', 'c', b.global_id, 'd'],
        'cheddar' => ['aa', b.global_id]
      }
      expect(e.tag_board(b, 'broccoli', true, false)).to eq(['bacon', 'cheddar'])
      expect(e.settings['board_tags']['bacon']).to eq(['a', 'b', 'c', b.global_id, 'd'])
      expect(e.settings['board_tags']['cheddar']).to eq(['aa', b.global_id])
    end

    it "should add a tag" do
      u = User.create
      e = UserExtra.create(user: u)
      b = Board.create(user: u)
      expect(u.user_extra).to eq(e)
      expect(e.tag_board(b, 'bacon', false, false)).to eq(['bacon'])
      expect(e.settings['board_tags']['bacon']).to eq([b.global_id])
      expect(e.settings['board_tags']['cheddar']).to eq(nil)
      e.settings['board_tags'] = {
        'bacon' => ['a', 'b', 'c', b.global_id, 'd'],
        'cheddar' => ['aa', b.global_id]
      }
      expect(e.tag_board(b, 'cheddar', false, false)).to eq(['bacon', 'cheddar'])
      expect(e.settings['board_tags']['bacon']).to eq(['a', 'b', 'c', b.global_id, 'd'])
      expect(e.settings['board_tags']['cheddar']).to eq(['aa', b.global_id])
      expect(e.tag_board(b, 'broccoli', false, false)).to eq(['bacon', 'broccoli', 'cheddar'])
      expect(e.settings['board_tags']['bacon']).to eq(['a', 'b', 'c', b.global_id, 'd'])
      expect(e.settings['board_tags']['cheddar']).to eq(['aa', b.global_id])
      expect(e.settings['board_tags']['broccoli']).to eq([b.global_id])
    end

    it "should include downstream boards if specified" do
      u = User.create
      e = UserExtra.create(user: u)
      b = Board.create(user: u)
      b.settings['downstream_board_ids'] = 'a', 'b', 'c'
      expect(u.user_extra).to eq(e)
      expect(e.tag_board(b, 'bacon', false, true)).to eq(['bacon'])
      expect(e.settings['board_tags']['bacon']).to eq([b.global_id, 'a', 'b', 'c'])
    end

    it "should return the latest list of tag names" do
      u = User.create
      e = UserExtra.create(user: u)
      b = Board.create(user: u)
      expect(u.user_extra).to eq(e)
      expect(e.tag_board(b, 'bacon', false, false)).to eq(['bacon'])
      expect(e.settings['board_tags']['cheddar']).to eq(nil)
      e.settings['board_tags'] = {
        'bacon' => ['a', 'b', 'c', b.global_id, 'd'],
        'cheddar' => ['aa', b.global_id]
      }
      expect(e.tag_board(b, 'cheddar', false, false)).to eq(['bacon', 'cheddar'])
      expect(e.tag_board(b, 'broccoli', false, false)).to eq(['bacon', 'broccoli', 'cheddar'])
    end

    it "should remove any empty tag names" do
      u = User.create
      e = UserExtra.create(user: u)
      b = Board.create(user: u)
      expect(u.user_extra).to eq(e)
      expect(e.tag_board(b, 'bacon', false, false)).to eq(['bacon'])
      expect(e.settings['board_tags']['bacon']).to eq([b.global_id])
      expect(e.settings['board_tags']['cheddar']).to eq(nil)
      e.settings['board_tags'] = {
        'bacon' => ['a', 'b', 'c', b.global_id, 'd'],
        'cheddar' => ['aa', b.global_id]
      }
      expect(e.tag_board(b, 'cheddar', false, false)).to eq(['bacon', 'cheddar'])
      expect(e.settings['board_tags']['bacon']).to eq(['a', 'b', 'c', b.global_id, 'd'])
      expect(e.settings['board_tags']['cheddar']).to eq(['aa', b.global_id])
      expect(e.tag_board(b, 'broccoli', false, false)).to eq(['bacon', 'broccoli', 'cheddar'])
      expect(e.tag_board(b, 'broccoli', true, false)).to eq(['bacon', 'cheddar'])
      expect(e.settings['board_tags']['broccoli']).to eq(nil)
    end
  end
end
